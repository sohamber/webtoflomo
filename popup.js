// 元素引用
const apiUrlInput = document.getElementById('apiUrl');
const toggleBtn = document.getElementById('toggleBtn');
const saveBtn = document.getElementById('save');

// 保存设置
function saveOptions() {
  const apiUrl = apiUrlInput.value.trim();
  const position = document.getElementById('position').value;
  
  if (!apiUrl) {
    showStatus('API 链接不能为空', '#ff4d4f');
    return;
  }

  if (!apiUrl.startsWith('https://flomoapp.com/iwh/')) {
    showStatus('链接格式错误，需以 https://flomoapp.com/iwh/ 开头', '#faad14');
  }

  chrome.storage.sync.set({
    flomoApiUrl: apiUrl,
    flomoButtonPosition: position
  }, () => {
    showStatus('保存成功！', '#52d68a');
    
    // 如果是在 tab 中打开的（窗口宽度较大），保存后不自动关闭，方便用户确认
    // 如果是在 popup 中打开的，自动关闭
    if (window.innerWidth < 400) {
      setTimeout(() => window.close(), 1500);
    }
  });
}

// 恢复设置
function restoreOptions() {
  chrome.storage.sync.get({
    flomoApiUrl: '',
    flomoButtonPosition: 'right'
  }, (items) => {
    apiUrlInput.value = items.flomoApiUrl;
    document.getElementById('position').value = items.flomoButtonPosition;
  });
}

// 切换密码显示状态
toggleBtn.addEventListener('click', () => {
  const type = apiUrlInput.getAttribute('type') === 'password' ? 'text' : 'password';
  apiUrlInput.setAttribute('type', type);
  
  // 切换图标样式（可选，这里简单处理，用颜色区分状态）
  toggleBtn.style.opacity = type === 'text' ? '1' : '0.4';
});

function showStatus(text, color) {
  const status = document.getElementById('status');
  status.textContent = text;
  status.style.color = color || '#333';
}

document.addEventListener('DOMContentLoaded', restoreOptions);
saveBtn.addEventListener('click', saveOptions);