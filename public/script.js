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
    images.forEach(imagePath => {
        const container = document.createElement('div');
        container.className = 'image-container';
        const imageName = imagePath.split('/').pop();
        container.innerHTML = `
            <img src="${imagePath}" alt="${imageName}" loading="lazy">
            <div class="image-actions">
                <button class="copy-btn" data-url="${imagePath}">复制链接</button>
                <button class="delete-btn" data-name="${imageName}">删除</button>
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
            deleteImage(this.getAttribute('data-name'));
        });
    });
}

function deleteImage(imageName) {
    console.log('开始删除图片:', imageName);
    console.log('直接发送删除请求，跳过确认');
    fetch(`/delete-image/${imageName}`, { method: 'DELETE' })
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
    navigator.clipboard.writeText(url).then(() => {
        alert('图片链接已复制到剪贴板');
    }).catch(err => {
        console.error('复制失败:', err);
        alert('复制图片链接失败');
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

// 初始加载所有图片
loadImages();

// 初始加载图片列表
loadImages();