// 定义全局变量
let copyUrl = '';
let msnry;
let currentPage = 1;
let totalPages = 1;
let currentSearchTerm = '';
let infScroll;
let loadedImageUrls = new Set();

// 初始化配置,获取复制URL
async function initConfig() {
    try {
        const response = await fetch('/config');
        const config = await response.json();
        copyUrl = config.copyUrl;
        console.log('Copy URL:', copyUrl);
    } catch (error) {
        console.error('Failed to fetch config:', error);
        copyUrl = window.location.origin;
    }
}

// 复制图片URL到剪贴板
function copyImageUrl(url) {
    const fullUrl = new URL(url, copyUrl).href;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(fullUrl)
            .then(() => {
                alert('图片链接已复制到剪贴板');
            })
            .catch(err => {
                console.error('复制失败:', err);
                fallbackCopyTextToClipboard(fullUrl);
            });
    } else {
        fallbackCopyTextToClipboard(fullUrl);
    }
}

// 复制文本到剪贴板的后备方法
function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        const msg = successful ? '图片链接已复制到剪贴板' : '复制失败，请手动复制链接';
        alert(msg);
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
        alert('复制失败，请手动复制链接');
    }

    document.body.removeChild(textArea);
}

// 显示加载中状态
function showLoading() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('content').style.display = 'none';
}

// 隐藏加载中状态
function hideLoading() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
}

// 更新图片画廊
function updateGallery(images) {
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = '';
    loadedImageUrls.clear();
    appendImages(images);
}

// 向画廊添加图片
function appendImages(images) {
    const gallery = document.getElementById('gallery');
    const fragment = document.createDocumentFragment();
    let newImagesAdded = false;

    images.forEach(image => {
        if (!loadedImageUrls.has(image.path)) {
            loadedImageUrls.add(image.path);
            const container = document.createElement('div');
            container.className = 'image-container';
            
            // 计算图片宽高比
            const [width, height] = image.resolution.split('x').map(Number);
            const aspectRatio = height / width * 100;
            
            // 创建图片容器HTML
            container.innerHTML = `
                <div class="image-wrapper" style="padding-top: ${aspectRatio}%;">
                    <img src="${image.thumbnailPath}" alt="${image.path.split('/').pop()}" data-full-image="${image.path}">
                    <div class="image-resolution">${image.resolution}</div>
                    <button class="copy-btn" data-url="${image.path}">复制链接</button>
                </div>
            `;
            fragment.appendChild(container);
            newImagesAdded = true;
        }
    });

    if (newImagesAdded) {
        gallery.appendChild(fragment);
        
        // 使用 imagesLoaded 确保所有图片加载完成后再布局
        imagesLoaded(gallery, function() {
            if (msnry) {
                msnry.reloadItems();
                msnry.layout();
            } else {
                initMasonry();
            }
        });

        // 绑定复制按钮事件
        gallery.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', handleCopyClick);
        });
    }
}

// 处理复制按钮点击事件
function handleCopyClick(e) {
    e.stopPropagation();
    const url = this.getAttribute('data-url');
    if (url) {
        copyImageUrl(url);
    }
}

// 初始化Masonry布局
function initMasonry() {
    const gallery = document.getElementById('gallery');
    msnry = new Masonry(gallery, {
        itemSelector: '.image-container',
        columnWidth: '.image-container',
        percentPosition: true,
        gutter: 20,
        transitionDuration: 0
    });
}

// 加载图片
async function loadImages(page = 1, searchTerm = '') {
    showLoading();
    try {
        const response = await fetch(`/get-images?page=${page}&search=${encodeURIComponent(searchTerm)}`);
        const data = await response.json();
        if (page === 1) {
            updateGallery(data.images);
        } else {
            appendImages(data.images);
        }
        currentPage = data.currentPage;
        totalPages = data.totalPages;
        if (page === 1) {
            initInfiniteScroll();
        }
        return data.images.length > 0;
    } catch (error) {
        console.error('Failed to load images:', error);
        alert('加载图片失败，请刷新页面重试');
        return false;
    } finally {
        hideLoading();
    }
}

// 更新分页
function updatePagination() {
    const paginationContainer = document.getElementById('pagination');
    paginationContainer.innerHTML = '';

    if (totalPages > 1) {
        // 创建上一页按钮
        const prevButton = document.createElement('button');
        prevButton.textContent = '上一页';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => loadImages(currentPage - 1, currentSearchTerm));
        paginationContainer.appendChild(prevButton);

        // 显示页码
        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            pageButton.classList.toggle('active', i === currentPage);
            pageButton.addEventListener('click', () => loadImages(i, currentSearchTerm));
            paginationContainer.appendChild(pageButton);
        }

        // 创建下一页按钮
        const nextButton = document.createElement('button');
        nextButton.textContent = '下一页';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => loadImages(currentPage + 1, currentSearchTerm));
        paginationContainer.appendChild(nextButton);
    }
}

// 处理搜索
function handleSearch(event) {
    if (event) {
        event.preventDefault();
    }
    const searchInput = event.target.querySelector('input[name="search"]');
    if (searchInput) {
        currentSearchTerm = searchInput.value;
        currentPage = 1;
        loadImages(1, currentSearchTerm);
    }
}

// 初始化事件监听器
function initEventListeners() {
    const uploadForm = document.querySelector('.upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUpload);
    }

    const searchForm = document.querySelector('.search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', handleSearch);
    }
}

// 处理图片上传
async function handleUpload(event) {
    if (event) {
        event.preventDefault();
    }
    const formData = new FormData(event.target);
    showLoading();
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        if (response.ok) {
            alert('图片上传成功');
            await loadImages(1, currentSearchTerm); // 重新加载第一页图片
        } else {
            throw new Error('Upload failed');
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('图片上传失败');
    } finally {
        hideLoading();
    }
}

// 初始化无限滚动
function initInfiniteScroll() {
    if (infScroll) {
        infScroll.destroy();
    }

    const gallery = document.getElementById('gallery');
    infScroll = new InfiniteScroll(gallery, {
        path: function() {
            if (this.loadCount < totalPages) {
                return `/get-images?page=${this.loadCount + 1}&search=${encodeURIComponent(currentSearchTerm)}`;
            }
        },
        responseBody: 'json',
        status: '.page-load-status',
        history: false,
        scrollThreshold: 400,
        loadOnScroll: true
    });

    infScroll.on('load', function(response) {
        const images = response.images;
        appendImages(images);
        if (images.length === 0 || currentPage >= totalPages) {
            infScroll.option({ loadOnScroll: false });
        }
    });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    await initConfig();
    initEventListeners();
    await loadImages();
    hideLoading();
});