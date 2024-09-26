const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const sharp = require('sharp');

// 创建Express应用
const app = express();
// 设置服务器端口,优先使用环境变量中的PORT,否则默认为3000
const PORT = process.env.PORT || 3000;
// 设置基础URL,优先使用环境变量中的BASE_URL,否则使用本地地址
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
// 设置复制URL,优先使用环境变量中的COPY_URL,否则使用BASE_URL
const COPY_URL = process.env.COPY_URL || BASE_URL;

// 缩略图文件名前缀
const THUMB_PREFIX = 'thumb_';

// 设置静态文件服务
app.use(express.static('public'));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// 配置multer存储选项
const storage = multer.diskStorage({
    // 设置文件存储目录
    destination: async function (req, file, cb) {
        const folderName = file.originalname; // 使用完整文件名作为文件夹名
        const folderPath = path.join(__dirname, 'public', 'images', folderName);
        try {
            // 创建文件夹(如果不存在)
            await fs.mkdir(folderPath, { recursive: true });
            cb(null, folderPath);
        } catch (error) {
            cb(error, null);
        }
    },
    // 设置文件名
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

// 创建multer上传中间件
const upload = multer({ storage: storage });

// 创建缩略图函数
async function createThumbnail(imagePath) {
    const thumbnailName = `${THUMB_PREFIX}${path.basename(imagePath)}`;
    const thumbnailPath = path.join(path.dirname(imagePath), thumbnailName);
    
    try {
        // 检查缩略图是否已存在
        await fs.access(thumbnailPath);
        return thumbnailPath;
    } catch (error) {
        try {
            // 创建新的缩略图
            const image = sharp(imagePath);
            const metadata = await image.metadata();
            const aspectRatio = metadata.width / metadata.height;

            // 计算缩略图尺寸,保持宽高比
            let width, height;
            if (aspectRatio > 1) {
                width = 300;
                height = Math.round(300 / aspectRatio);
            } else {
                height = 300;
                width = Math.round(300 * aspectRatio);
            }

            // 生成并保存缩略图
            await image
                .resize(width, height, { fit: 'inside', withoutEnlargement: true })
                .toFormat('jpeg')
                .toFile(thumbnailPath);

            return thumbnailPath;
        } catch (err) {
            console.error('创建缩略图时出错:', err);
            throw err;
        }
    }
}

// 获取图片信息函数
async function getImageInfo(filePath) {
    try {
        const metadata = await sharp(filePath).metadata();
        return {
            width: metadata.width,
            height: metadata.height,
            resolution: metadata.width * metadata.height
        };
    } catch (error) {
        console.error(`获取图片信息失败 ${filePath}:`, error);
        return {
            width: 0,
            height: 0,
            resolution: 0
        };
    }
}

// 设置每页显示的图片数量
const IMAGES_PER_PAGE = 20;

// 递归获取图片信息函数
async function getImagesRecursively(dir, searchTerm = '') {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let results = [];
    let maxResolutionImage = null;
    let maxResolution = 0;

    for (let entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            // 如果是目录,递归调用
            const subDirImages = await getImagesRecursively(fullPath, searchTerm);
            results = results.concat(subDirImages);
        } else {
            // 如果是文件,检查是否为图片且符合搜索条件
            const ext = path.extname(entry.name).toLowerCase();
            if (!entry.name.startsWith(THUMB_PREFIX) && 
                ['.jpg', '.jpeg', '.png', '.gif'].includes(ext) && 
                (!searchTerm || entry.name.toLowerCase().includes(searchTerm))) {
                const imageInfo = await getImageInfo(fullPath);
                // 更新最大分辨率图片信息
                if (imageInfo.resolution > maxResolution) {
                    maxResolution = imageInfo.resolution;
                    maxResolutionImage = {
                        path: fullPath,
                        ...imageInfo
                    };
                }
            }
        }
    }

    // 处理最大分辨率图片
    if (maxResolutionImage) {
        const relativePath = path.relative(path.join(__dirname, 'public'), maxResolutionImage.path);
        const publicPath = '/' + relativePath.replace(/\\/g, '/');
        const thumbnailPath = await createThumbnail(maxResolutionImage.path);
        const thumbnailPublicPath = '/' + path.relative(path.join(__dirname, 'public'), thumbnailPath).replace(/\\/g, '/');
        
        results.push({
            path: publicPath,
            thumbnailPath: thumbnailPublicPath,
            resolution: `${maxResolutionImage.width}x${maxResolutionImage.height}`,
            isDirectory: false
        });
    }

    return results;
}

// 获取图片列表的路由
app.get('/get-images', async (req, res) => {
    const searchTerm = req.query.search ? req.query.search.toLowerCase() : '';
    const page = parseInt(req.query.page) || 1;
    const imagesDir = path.join(__dirname, 'public', 'images');
    
    try {
        // 获取所有符合条件的图片
        const allImages = await getImagesRecursively(imagesDir, searchTerm);
        const totalImages = allImages.length;
        const totalPages = Math.ceil(totalImages / IMAGES_PER_PAGE);
        const startIndex = (page - 1) * IMAGES_PER_PAGE;
        const endIndex = startIndex + IMAGES_PER_PAGE;
        // 分页处理
        const paginatedImages = allImages.slice(startIndex, endIndex);

        res.json({
            images: paginatedImages,
            currentPage: page,
            totalPages: totalPages,
            totalImages: totalImages
        });
    } catch (error) {
        console.error('读取图片目录失败:', error);
        res.status(500).json({ error: '无法读取图片目录' });
    }
});

// 文件上传路由
app.post('/upload', upload.array('images'), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('没有上传文件。');
    }
    try {
        // 为每个上传的文件创建缩略图
        for (const file of req.files) {
            const imagePath = path.join(file.destination, file.filename);
            await createThumbnail(imagePath);
        }
        res.send('文件上传成功');
    } catch (error) {
        console.error('处理上传文件时出错:', error);
        res.status(500).send('处理上传文件时出错');
    }
});

// 获取所有图片列表的路由
app.get('/images', (req, res) => {
    const imagesDir = path.join(__dirname, 'public', 'images');
    fs.readdir(imagesDir, (err, files) => {
        if (err) {
            res.status(500).json({ success: false, message: '无法读取图片目录' });
        } else {
            const images = files.map(file => ({
                name: file,
                url: `/images/${file}`
            }));
            res.json(images);
        }
    });
});

// 删除图片的路由
app.delete('/delete-image/:imagePath(*)', async (req, res) => {
    const imagePath = req.params.imagePath;
    const fullImagePath = path.join(__dirname, 'public', imagePath);

    console.log('图片路径:', fullImagePath);

    try {
        await fs.access(fullImagePath); // 检查文件是否存在
        await fs.unlink(fullImagePath); // 删除文件
        console.log('图片删除成功');
        res.json({ success: true, message: '图片删除成功' });
    } catch (error) {
        console.error('删除图片失败:', error);
        if (error.code === 'ENOENT') {
            res.status(404).json({ success: false, message: '文件不存在' });
        } else {
            res.status(500).json({ success: false, message: '删除图片失败: ' + error.message });
        }
    }
});

// 获取配置信息的路由
app.get('/config', (req, res) => {
    res.json({
        copyUrl: process.env.COPY_URL || `http://${req.headers.host}`
    });
});

// 健康检查路由
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// 获取图片的路由
app.get('/images/:imageName', (req, res) => {
    const imagePath = path.join(__dirname, 'public', 'images', req.params.imageName);
    console.log(`尝试加载图片: ${imagePath}`);
    fs.access(imagePath, fs.constants.R_OK, (err) => {
        if (err) {
            console.error(`无法访问图片: ${imagePath}`, err);
            return res.status(404).send('图片不存在或无法访问');
        }
        res.sendFile(imagePath);
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 ${BASE_URL}`);
});
