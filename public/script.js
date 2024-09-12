let baseUrl = '';
let msnry;

async function initConfig() {
    try {
        const response = await fetch('/config');
        const config = await response.json();
        baseUrl = config.baseUrl;
        console.log('Base URL:', baseUrl);
    } catch (error) {
        console.error('Failed to fetch config:', error);
        baseUrl = window.location.origin;
    }
}

async function loadImages(searchTerm = '') {
    fetch(`/get-images?search=${encodeURIComponent(searchTerm)}`)
        .then(response => response.json())
        .then(data => {
            updateGallery(data);
        })
        .catch(error => console.error('加载图片失败:', error));
}

function loadImage(imgElement, src, retries = 3) {
    imgElement.src = src;
    imgElement.onerror = () => {
        if (retries > 0) {
            setTimeout(() => {
                console.log(`重试加载图片: ${src}, 剩余尝试次数: ${retries - 1}`);
                loadImage(imgElement, src, retries - 1);
            }, 1000);
        } else {
            console.error(`无法加载图片: ${src}`);
            imgElement.src = 'path/to/fallback-image.jpg'; // 使用一个占位图片
        }
    };
}

function updateGallery(images) {
    console.log('Updating gallery with', images.length, 'images');
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = '';
    let loadedImages = 0;
    const totalImages = images.length;

    const loadTimeout = setTimeout(() => {
        console.log('Loading timeout reached, initializing Masonry anyway');
        initMasonry();
    }, 10000); // 10秒后强制初始化

    images.forEach((image, index) => {
        console.log('Processing image', index + 1, 'of', totalImages);
        const container = document.createElement('div');
        container.className = 'image-container';
        container.innerHTML = `
            <img src="${image.thumbnailPath}" alt="${image.path.split('/').pop()}" data-full-image="${image.path}" loading="lazy">
            <div class="image-resolution">${image.resolution}</div>
            <div class="image-actions">
                <button class="copy-btn" data-url="${image.path}">复制链接</button>
                <button class="delete-btn" data-path="${image.path}">删除</button>
            </div>
        `;
        gallery.appendChild(container);

        const img = container.querySelector('img');
        loadImage(img, image.thumbnailPath);

        img.onload = () => {
            loadedImages++;
            console.log('Image loaded:', loadedImages, 'of', totalImages);
            if (loadedImages === totalImages) {
                clearTimeout(loadTimeout);
                console.log('All images loaded, initializing Masonry');
                initMasonry();
            }
        };
        img.onerror = () => {
            loadedImages++;
            console.error('Failed to load image:', image.path);
            if (loadedImages === totalImages) {
                console.log('All images processed, initializing Masonry');
                initMasonry();
            }
        };
    });

    // 绑定事件监听器
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); // 阻止事件冒泡
            copyImageUrl(this.getAttribute('data-url'));
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); // 阻止事件冒泡
            deleteImage(this.getAttribute('data-path'));
        });
    });

    document.querySelectorAll('.image-container').forEach(container => {
        container.addEventListener('click', function() {
            const fullImageUrl = this.querySelector('img').getAttribute('data-full-image');
            window.open(fullImageUrl, '_blank');
        });
    });
}

// 初始化瀑布流布局
function initMasonry() {
    console.log('Initializing Masonry');
    if (msnry) {
        console.log('Destroying existing Masonry instance');
        msnry.destroy();
    }
    const gallery = document.getElementById('gallery');
    msnry = new Masonry(gallery, {
        itemSelector: '.image-container',
        columnWidth: '.image-container',
        percentPosition: true
    });
    console.log('Masonry initialized');
}

function deleteImage(imagePath) {
    console.log('开始删除图片:', imagePath);
    fetch(`/delete-image${imagePath}`, { method: 'DELETE' })
        .then(response => {
            console.log('收到服务器响应，状态码:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('服务器响应数据:', data);
            if (data.success) {
                console.log('删除成功，准备刷新页面');
                alert('图片删除成功');
                location.reload();
            } else {
                console.log('删除失败:', data.message);
                alert('图片删除失败: ' + data.message);
            }
        })
        .catch(error => {
            console.error('删除过程中发生错误:', error);
            alert('删除过程中发生错误');
        });
}

function copyImageUrl(url) {
    const fullUrl = new URL(url, window.location.origin).href;
    navigator.clipboard.writeText(fullUrl).then(() => {
        alert('图片链接已复制到剪贴板');
    }).catch(err => {
        console.error('复制失败:', err);
        alert('复制失败，请手动复制链接');
    });
}

document.getElementById('fileInput').addEventListener('change', function(e) {
    const files = e.target.files;
    if (files.length > 0) {
        const formData = new FormData();
        Array.from(files).forEach(file => {
            formData.append('images', file);
        });

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('图片上传成功!');
                location.reload(); // 上传成功后刷新页面
            } else {
                alert('图片上传失败: ' + data.message);
            }
        })
        .catch(error => {
            console.error('上传错误:', error);
            alert('上传过程中发生错误');
        });
    }
});

// 为搜索按钮添加事件监听器
document.getElementById('searchButton').addEventListener('click', function() {
    const searchTerm = document.getElementById('searchInput').value;
    loadImages(searchTerm);
});

// 为搜索输入框添加 Enter 键事件监听器
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const searchTerm = this.value;
        loadImages(searchTerm);
    }
});

// 在页面加载时初始化配置
initConfig().then(() => {
    loadImages(); // 加载图片
});

// 初始加载片列表
loadImages();

// 在页面加载完成后初始化瀑布流布局
window.addEventListener('load', initMasonry);