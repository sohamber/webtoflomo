// 扩展安装或更新时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "send-to-flomo",
    title: "发送到 flomo",
    contexts: ["selection"]
  });
});

// 监听右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "send-to-flomo" && info.selectionText) {
    handleSendRequest(info.selectionText, tab.title, tab.url);
  }
});

// 监听来自 content.js (悬浮按钮) 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sendText") {
    handleSendRequest(request.text, sender.tab.title, sender.tab.url);
  }
});

// 核心处理函数：发送数据到 flomo
function handleSendRequest(text, pageTitle, pageUrl) {
  chrome.storage.sync.get(['flomoApiUrl'], async (result) => {
    const apiUrl = result.flomoApiUrl;

    if (!apiUrl) {
      // 【改动】检测到未配置，自动在新标签页打开 popup.html 进行配置
      chrome.tabs.create({ url: 'popup.html' });
      
      // 同时弹个通知告知用户为什么要打开新页面
      showNotification('需要配置', '请在自动打开的设置页面中填入 flomo API 链接。');
      return;
    }

    const safeTitle = pageTitle.replace(/[\[\]]/g, ' ');
    const fromSource = `[${safeTitle}](${pageUrl})`;
    const content = `${text}\n\n#ChromeClipping from ${fromSource}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content })
      });

      if (response.ok) {
        showNotification('发送成功', '内容已飞入 flomo');
      } else {
        showNotification('发送失败', `状态码: ${response.status}`);
      }
    } catch (error) {
      showNotification('网络错误', '无法连接到 flomo');
      console.error(error);
    }
  });
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: title,
    message: message
  });
}