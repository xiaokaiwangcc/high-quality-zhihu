let currentPage = 1; // 当前页面
const imagesPerPage = 20; // 每次加载的图片数量

document.addEventListener('DOMContentLoaded', function() {
    loadImages();

    // 监听滚动事件
    window.addEventListener('scroll', () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight) {
            loadImages(); // 当滚动到页面底部时加载更多图片
        }
    });

    // 监听来自原始页面的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "loadMoreImages") {
            loadImages(); // 加载更多图片
        }
    });
});

function loadImages() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            function: getImages
        }, (results) => {
            const imageContainer = document.getElementById('imageContainer');
            const countElement = document.getElementById('count');
            const images = results[0].result || [];

            // 更新图片数量
            countElement.textContent = images.length;

            // 只加载当前页面的图片
            const start = (currentPage - 1) * imagesPerPage;
            const end = start + imagesPerPage;
            const imagesToLoad = images.slice(start, end);

            imagesToLoad.forEach(url => {
                const img = document.createElement('img');
                img.src = url;

                // 添加点击事件，打开大图
                img.addEventListener('click', () => {
                    window.open(url, '_blank'); // 在新窗口中打开大图
                });

                imageContainer.appendChild(img);
            });

            currentPage++; // 增加当前页面计数
        });
    });
}

function getImages() {
    const images = Array.from(document.images);
    return images
        .filter(img => {
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            const aspectRatio = width / height;
            const src = img.src.toLowerCase();

            // 过滤SVG占位图
            if (src.includes('data:image/svg+xml') || src.includes('<svg')) {
                return false;
            }

            // 过滤小图片和宽高比不合理的图片
            return width > 100 && height > 100 && aspectRatio >= 0.5 && aspectRatio <= 2;
        })
        .map(img => img.src);
}