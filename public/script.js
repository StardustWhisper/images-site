let baseUrl = '';

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

function updateGallery(images) {
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = '';
    images.forEach(image => {
        const container = document.createElement('div');
        container.className = 'image-container';
        container.innerHTML = `
            <img src="${image.path}" alt="${image.path.split('/').pop()}" loading="lazy">
            <div class="image-resolution">${image.resolution}</div>
            <div class="image-actions">
                <button class="copy-btn" data-url="${image.path}">复制链接</button>
                <button class="delete-btn" data-path="${image.path}">删除</button>
            </div>
        `;
        gallery.appendChild(container);
    });

    // 重新绑定事件监听器
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            copyImageUrl(this.getAttribute('data-url'));
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            deleteImage(this.getAttribute('data-path'));
        });
    });
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
    const fullUrl = new URL(url, baseUrl).href;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullUrl).then(() => {
            alert('图片链接已复制到剪贴板');
        }).catch(err => {
            console.error('复制失败:', err);
            fallbackCopyTextToClipboard(fullUrl);
        });
    } else {
        fallbackCopyTextToClipboard(fullUrl);
    }
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

// 初始加载图片列表
loadImages();