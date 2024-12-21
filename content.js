// 处理页面上的回答
function processAnswers() {
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

// 创建一个观察器来处理动态加载的内容
const observer = new MutationObserver((mutations) => {
    processAnswers();
});

// 开始观察页面变化
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// 初始处理
processAnswers();
