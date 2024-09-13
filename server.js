const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const COPY_URL = process.env.COPY_URL || BASE_URL;

// 缩略图标记
const THUMB_PREFIX = 'thumb_';

// 静态文件服务
app.use(express.static('public'));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// 配置 multer 存储
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        const folderName = file.originalname; // 使用完整文件名作为文件夹名
        const folderPath = path.join(__dirname, 'public', 'images', folderName);
        try {
            await fs.mkdir(folderPath, { recursive: true });
            cb(null, folderPath);
        } catch (error) {
            cb(error, null);
        }
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

async function createThumbnail(imagePath) {
    const thumbnailName = `${THUMB_PREFIX}${path.basename(imagePath)}`;
    const thumbnailPath = path.join(path.dirname(imagePath), thumbnailName);
    
    try {
        await fs.access(thumbnailPath);
        return thumbnailPath;
    } catch (error) {
        try {
            const image = sharp(imagePath);
            const metadata = await image.metadata();
            const aspectRatio = metadata.width / metadata.height;

            let width, height;
            if (aspectRatio > 1) {
                width = 300;
                height = Math.round(300 / aspectRatio);
            } else {
                height = 300;
                width = Math.round(300 * aspectRatio);
            }

            await image
                .resize(width, height, { fit: 'inside', withoutEnlargement: true })
                .toFormat('jpeg')
                .toFile(thumbnailPath);

            return thumbnailPath;
        } catch (err) {
            console.error('Error creating thumbnail:', err);
            throw err;
        }
    }
}

async function getImageInfo(filePath) {
    try {
        const metadata = await sharp(filePath).metadata();
        return {
            width: metadata.width,
            height: metadata.height,
            resolution: metadata.width * metadata.height
        };
    } catch (error) {
        console.error(`Error getting image info for ${filePath}:`, error);
        return {
            width: 0,
            height: 0,
            resolution: 0
        };
    }
}

const IMAGES_PER_PAGE = 20; // 每页显示的图片数量

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

app.get('/get-images', async (req, res) => {
    const searchTerm = req.query.search ? req.query.search.toLowerCase() : '';
    const page = parseInt(req.query.page) || 1;
    const imagesDir = path.join(__dirname, 'public', 'images');
    
    try {
        const allImages = await getImagesRecursively(imagesDir, searchTerm);
        const totalImages = allImages.length;
        const totalPages = Math.ceil(totalImages / IMAGES_PER_PAGE);
        const startIndex = (page - 1) * IMAGES_PER_PAGE;
        const endIndex = startIndex + IMAGES_PER_PAGE;
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

app.post('/upload', upload.array('images'), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('No files uploaded.');
    }
    try {
        for (const file of req.files) {
            const imagePath = path.join(file.destination, file.filename);
            await createThumbnail(imagePath);
        }
        res.send('Files uploaded successfully');
    } catch (error) {
        console.error('Error processing uploaded files:', error);
        res.status(500).send('Error processing uploaded files');
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
    res.json({
        copyUrl: process.env.COPY_URL || `http://${req.headers.host}`
    });
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
