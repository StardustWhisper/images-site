async function loadImages() {
    const gallery = document.getElementById('gallery');
    
    try {
        const response = await fetch('/get-images');
        const images = await response.json();
        
        images.forEach(imagePath => {
            const imgElement = document.createElement('img');
            imgElement.src = imagePath;
            
            const copyLinkBtn = document.createElement('button');
            copyLinkBtn.className = 'copy-link-btn';
            copyLinkBtn.textContent = '复制链接';
            copyLinkBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                copyImageLink(imagePath);
            });
            
            const divElement = document.createElement('div');
            divElement.className = 'image-item';
            divElement.appendChild(imgElement);
            divElement.appendChild(copyLinkBtn);
            
            gallery.appendChild(divElement);
        });
    } catch (error) {
        console.error('加载图片时出错:', error);
    }
}

function copyImageLink(imagePath) {
    const fullUrl = new URL(imagePath, window.location.origin).href;
    navigator.clipboard.writeText(fullUrl).then(() => {
        alert('图片链接已复制到剪贴板');
    }).catch(err => {
        console.error('复制失败:', err);
    });
}

loadImages();