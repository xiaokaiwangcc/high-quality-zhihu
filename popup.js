let currentPage = 1;
const imagesPerPage = 100;
let allImages = []; // 存储所有图片URL

document.addEventListener('DOMContentLoaded', function() {
    const autoDownloadSwitch = document.getElementById('autoDownload');
    const filterSwitch = document.getElementById('filterEnabled');
    const downloadBtn = document.getElementById('downloadBtn');

    // 从storage中读取设置
    chrome.storage.local.get(['autoDownload', 'filterEnabled'], function(result) {
        // 检查是否有图片，如果没有图片则禁用自动下载开关
        if (allImages.length === 0) {
            autoDownloadSwitch.disabled = true;
        } else {
            autoDownloadSwitch.disabled = false;
        }

        autoDownloadSwitch.checked = result.autoDownload || false;
        filterSwitch.checked = result.filterEnabled !== false; // 默认开启
        
        // 初始化过滤状态
        if (filterSwitch.checked) {
            sendFilterState(true);
        }
    });

    // 监听自动下载开关
    autoDownloadSwitch.addEventListener('change', function() {
        chrome.storage.local.set({ autoDownload: this.checked });
    });

    // 监听过滤开关
    filterSwitch.addEventListener('change', function() {
        chrome.storage.local.set({ filterEnabled: this.checked });
        sendFilterState(this.checked);
    });

    // 监听下载按钮
    downloadBtn.addEventListener('click', function() {
        downloadAllImagesAsZip();
    });

    // 在加载图片时更新自动下载开关状态
    function updateAutoDownloadSwitch() {
        if (allImages.length > 0) {
            autoDownloadSwitch.disabled = false;
        }
    }

    // 修改 loadImages 函数以调用更新函数
    const originalLoadImages = loadImages;
    loadImages = function() {
        originalLoadImages();
        updateAutoDownloadSwitch();
    };

    loadImages();

    window.addEventListener('scroll', () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight) {
            loadImages();
        }
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "loadMoreImages") {
            loadImages();
        }
    });
});

function sendFilterState(enabled) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            action: "setFilterState",
            enabled: enabled
        });
    });
}

async function convertToPng(url) {
    try {
        const response = await fetch(url, {
            mode: 'cors',
            credentials: 'omit'
        });
        const blob = await response.blob();
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                
                canvas.toBlob((blob) => {
                    resolve(URL.createObjectURL(blob));
                }, 'image/png');
            };
            
            img.onerror = () => {
                reject(new Error('Image load failed'));
            };
            
            img.src = URL.createObjectURL(blob);
        });
    } catch (error) {
        console.error('获取图片失败:', error);
        throw error;
    }
}

async function downloadAllImagesAsZip() {
    const downloadBtn = document.getElementById('downloadBtn');
    downloadBtn.disabled = true;
    downloadBtn.textContent = '准备下载...';
    
    try {
        const zip = new JSZip();
        const uniqueImages = [...new Set(allImages)];
        
        downloadBtn.textContent = '转换图片中...';
        
        const promises = uniqueImages.map(async (url, index) => {
            try {
                const pngUrl = await convertToPng(url);
                const response = await fetch(pngUrl);
                const blob = await response.blob();
                const filename = `image_${(index + 1).toString().padStart(3, '0')}.png`;
                
                zip.file(filename, blob);
                downloadBtn.textContent = `转换中 ${index + 1}/${uniqueImages.length}`;
                
                // 清理临时URL
                URL.revokeObjectURL(pngUrl);
            } catch (err) {
                console.error('转换图片失败:', url, err);
            }
        });
        
        await Promise.all(promises);
        
        downloadBtn.textContent = '打包中...';
        
        const content = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: {
                level: 5
            }
        });
        // 文件名规范, 中国时区
        const timestamp = new Date().toLocaleString().replace(/:/g, '_').replace(/\//g, '-');
        const zipFilename = `图片_${timestamp}.zip`;
        
        const downloadUrl = URL.createObjectURL(content);
        chrome.downloads.download({
            url: downloadUrl,
            filename: zipFilename,
            saveAs: true
        }, () => {
            URL.revokeObjectURL(downloadUrl);
        });
        
        downloadBtn.textContent = '下载完成';
        setTimeout(() => {
            downloadBtn.textContent = '下载全部';
            downloadBtn.disabled = false;
        }, 2000);
        
    } catch (error) {
        console.error('下载失败:', error);
        downloadBtn.textContent = '下载失败';
        setTimeout(() => {
            downloadBtn.textContent = '下载全部';
            downloadBtn.disabled = false;
        }, 2000);
    }
}

async function convertAndDownloadImage(url) {
    try {
        const pngUrl = await convertToPng(url);
        const filename = `image_${Date.now()}.png`;
        
        chrome.downloads.download({
            url: pngUrl,
            filename: `zhihu_images/${filename}`,
            conflictAction: 'uniquify'
        }, () => {
            URL.revokeObjectURL(pngUrl);
        });
    } catch (error) {
        console.error('转换图片失败:', error);
    }
}

function loadImages() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            function: getImages
        }, (results) => {
            const imageContainer = document.getElementById('imageContainer');
            const countElement = document.getElementById('count');
            const images = results[0].result || [];
            
            allImages = [...new Set([...allImages, ...images])];
            countElement.textContent = allImages.length;

            const start = (currentPage - 1) * imagesPerPage;
            const end = start + imagesPerPage;
            const imagesToLoad = allImages.slice(start, end);

            imagesToLoad.forEach(url => {
                if (!document.querySelector(`img[src="${url}"]`)) {
                    const imageCard = document.createElement('div');
                    imageCard.className = 'image-card';
                    
                    const img = document.createElement('img');
                    img.src = url;
                    img.loading = 'lazy';

                    img.addEventListener('click', () => {
                        window.open(url, '_blank');
                    });

                    imageCard.appendChild(img);
                    imageContainer.appendChild(imageCard);

                    chrome.storage.local.get(['autoDownload'], function(result) {
                        if (result.autoDownload) {
                            convertAndDownloadImage(url);
                        }
                    });
                }
            });

            currentPage++;
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

            if (src.includes('data:image/svg+xml') || src.includes('<svg')) {
                return false;
            }

            return width > 100 && height > 100 && aspectRatio >= 0.5 && aspectRatio <= 2;
        })
        .map(img => img.src);
}