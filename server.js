const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// 缩略图标记
const THUMB_PREFIX = 'thumb_';

// 静态文件服务
app.use(express.static('public'));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

async function createThumbnail(imagePath) {
    const thumbnailName = `${THUMB_PREFIX}${path.basename(imagePath)}`;
    const thumbnailPath = path.join(path.dirname(imagePath), thumbnailName);
    
    try {
        await fs.access(thumbnailPath);
        return thumbnailPath;
    } catch (error) {
        await sharp(imagePath)
            .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
            .toFile(thumbnailPath);
        return thumbnailPath;
    }
}

async function getImageInfo(filePath) {
    const metadata = await sharp(filePath).metadata();
    return {
        width: metadata.width,
        height: metadata.height,
        resolution: metadata.width * metadata.height
    };
}

async function getImagesRecursively(dir, searchTerm = '') {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let results = [];
    let maxResolutionImage = null;
    let maxResolution = 0;

    for (let entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const subDirImages = await getImagesRecursively(fullPath, searchTerm);
            results = results.concat(subDirImages);
        } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (!entry.name.startsWith(THUMB_PREFIX) && 
                ['.jpg', '.jpeg', '.png', '.gif'].includes(ext) && 
                (!searchTerm || entry.name.toLowerCase().includes(searchTerm))) {
                const imageInfo = await getImageInfo(fullPath);
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

// 在上传图片时创建缩略图
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
});

const upload = multer({ storage: storage });

app.get('/get-images', async (req, res) => {
    console.log('Received request for images');
    const searchTerm = req.query.search ? req.query.search.toLowerCase() : '';
    const imagesDir = path.join(__dirname, 'public', 'images');
    
    try {
        console.log('Searching for images in:', imagesDir);
        const imagePaths = await getImagesRecursively(imagesDir, searchTerm);
        console.log('Found', imagePaths.length, 'images');
        res.json(imagePaths);
    } catch (error) {
        console.error('读取图片目录失败:', error);
        res.status(500).json({ error: '无法读取图片目录' });
    }
});

app.post('/upload', upload.array('images', 10), async (req, res) => {
    if (req.files && req.files.length > 0) {
        for (let file of req.files) {
            await createThumbnail(file.path);
        }
        res.json({ success: true, message: '图片上传成功' });
    } else {
        res.json({ success: false, message: '图片上传失败' });
    }
});

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

app.get('/config', (req, res) => {
    res.json({ baseUrl: BASE_URL });
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

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

app.listen(PORT, () => {
    console.log(`服务器运行在 ${BASE_URL}`);
});
