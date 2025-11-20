// --- 1. 全局变量定义 ---
let currentSelectionText = '';
let isDragging = false;
let hasMoved = false;
let dragStartX, dragStartY;

// 存储用户偏好的位置，默认为 'right' (正右侧)
let userPositionPreference = 'right';

// 初始化时读取用户设置
chrome.storage.sync.get(['flomoButtonPosition'], (result) => {
    if (result.flomoButtonPosition) {
        userPositionPreference = result.flomoButtonPosition;
    }
});

// 监听设置变化
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.flomoButtonPosition) {
        userPositionPreference = changes.flomoButtonPosition.newValue;
    }
});

// --- 2. 创建悬浮按钮 DOM (文字样式) ---
const flomoBtn = document.createElement('div');
flomoBtn.id = 'flomo-floating-btn';
flomoBtn.title = '发送到 flomo (按住可拖动)';
flomoBtn.innerText = '发送到 flomo'; 
document.body.appendChild(flomoBtn);

// --- 3. 核心交互逻辑 ---

document.addEventListener('mouseup', (e) => {
    if (isDragging || flomoBtn.contains(e.target)) return;

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 0) {
        currentSelectionText = text;
        showButton(selection);
    } else {
        hideButton();
    }
});

document.addEventListener('mousedown', (e) => {
    // 只有当点击的不是按钮本身时，才考虑隐藏逻辑（交给 mouseup 处理）
    if (!flomoBtn.contains(e.target)) {
    }
});

// --- 4. 按钮的拖拽与点击处理 ---

flomoBtn.addEventListener('mousedown', (e) => {
    isDragging = true;
    hasMoved = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const rect = flomoBtn.getBoundingClientRect();
    const shiftX = e.clientX - rect.left;
    const shiftY = e.clientY - rect.top;

    function onMouseMove(event) {
        if (!isDragging) return;
        const moveDist = Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY);
        if (moveDist > 3) {
            hasMoved = true;
            flomoBtn.classList.add('dragging');
        }
        if (hasMoved) {
            event.preventDefault();
            flomoBtn.style.left = (event.pageX - shiftX) + 'px';
            flomoBtn.style.top = (event.pageY - shiftY) + 'px';
        }
    }

    function onMouseUp(event) {
        isDragging = false;
        flomoBtn.classList.remove('dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
});

flomoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (hasMoved) return;

    chrome.runtime.sendMessage({
        action: "sendText",
        text: currentSelectionText
    });

    flomoBtn.style.transform = 'scale(0.95)';
    flomoBtn.innerText = '发送成功!';
    setTimeout(() => {
        flomoBtn.style.transform = 'scale(1)';
        flomoBtn.innerText = '发送到 flomo';
        hideButton();
        window.getSelection().removeAllRanges();
    }, 500);
});

// --- 5. 辅助函数：定位计算 (精准光标定位版) ---

function showButton(selection) {
    if (selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    
    // 【核心修改】精准获取选区结束点（光标位置）的矩形
    // 这样无论最后一行选了几个字，按钮都会紧贴着选区结束的位置
    let targetRect = null;

    try {
        // 克隆选区并折叠到末尾 (false 表示 collapse to end)
        const endRange = range.cloneRange();
        endRange.collapse(false);
        const endRects = endRange.getClientRects();
        
        if (endRects.length > 0) {
            targetRect = endRects[0];
        }
    } catch (e) {
        console.error("Flomo extension position error", e);
    }

    // 如果获取不到光标点（极少数情况），回退到使用最后一行
    if (!targetRect || targetRect.height === 0) {
        const rects = range.getClientRects();
        if (rects.length > 0) {
            targetRect = rects[rects.length - 1];
        } else {
            targetRect = range.getBoundingClientRect();
        }
    }
    
    // 显示按钮以计算宽高
    flomoBtn.style.display = 'flex';
    flomoBtn.style.opacity = '0';
    
    const btnWidth = flomoBtn.offsetWidth;
    const btnHeight = flomoBtn.offsetHeight;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const gap = 10; // 按钮与光标的水平间距

    let top, left;

    // 这里的 targetRect 现在代表的是“光标”那个细长条的位置
    switch (userPositionPreference) {
        case 'right': // 正右侧 (紧随光标)
            left = targetRect.right + scrollX + gap;
            // 垂直居中对齐光标所在行
            top = targetRect.top + scrollY + (targetRect.height / 2) - (btnHeight / 2);
            break;
            
        case 'top-right': // 右上角
            left = targetRect.right + scrollX; 
            // 如果太靠左（比如选区结束在行首），往右推一点
            if (left < targetRect.left + scrollX) left = targetRect.left + scrollX + gap;
            top = targetRect.top + scrollY - btnHeight - gap;
            break;
            
        case 'bottom-right': // 右下角
            left = targetRect.right + scrollX;
            if (left < targetRect.left + scrollX) left = targetRect.left + scrollX + gap;
            top = targetRect.bottom + scrollY + gap;
            break;

        case 'top': // 正上方 (相对于光标居中)
            left = targetRect.right + scrollX - (btnWidth / 2);
            top = targetRect.top + scrollY - btnHeight - gap;
            break;
            
        case 'bottom': // 正下方 (相对于光标居中)
            left = targetRect.right + scrollX - (btnWidth / 2);
            top = targetRect.bottom + scrollY + gap;
            break;
            
        default: // 默认 right
            left = targetRect.right + scrollX + gap;
            top = targetRect.top + scrollY + (targetRect.height / 2) - (btnHeight / 2);
    }

    // 【边界检查】防止按钮飞出屏幕右边缘
    const maxLeft = document.documentElement.scrollWidth - btnWidth - 5;
    if (left > maxLeft) {
        left = maxLeft;
    }
    // 防止飞出左边缘
    if (left < 0) left = 0;
    
    flomoBtn.style.top = `${top}px`;
    flomoBtn.style.left = `${left}px`;

    requestAnimationFrame(() => {
        flomoBtn.style.transition = 'transform 0.15s ease, opacity 0.2s ease';
        flomoBtn.style.opacity = '1';
        flomoBtn.style.transform = 'translate(0, 0)';
    });
}

function hideButton() {
    flomoBtn.style.display = 'none';
    flomoBtn.style.opacity = '0';
}