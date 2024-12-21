let filterEnabled = true;

// 处理页面上的回答
function processAnswers() {
    if (!filterEnabled) return;

    // 获取所有回答容器
    const answers = document.querySelectorAll('.List-item, .AnswerItem');
    
    answers.forEach(answer => {
        const richContent = answer.querySelector('.RichContent.RichContent--unescapable');
        if (richContent) {
            const hasImage = richContent.querySelector('figure') || richContent.querySelector('img');
            if (!hasImage) {
                answer.style.display = 'none';
            }
        }
    });
}

// 显示所有回答
function showAllAnswers() {
    const answers = document.querySelectorAll('.List-item, .AnswerItem');
    answers.forEach(answer => {
        answer.style.display = '';
    });
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'setFilterState') {
        filterEnabled = request.enabled;
        if (filterEnabled) {
            processAnswers();
        } else {
            showAllAnswers();
        }
    }
});

// 创建一个观察器来处理动态加载的内容
const observer = new MutationObserver((mutations) => {
    if (filterEnabled) {
        processAnswers();
    }
});

// 开始观察页面变化
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// 初始处理
processAnswers();
