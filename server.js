const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// 静态文件服务
app.use(express.static('public'));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
});

const upload = multer({ storage: storage });

async function getImageInfo(filePath) {
    try {
        const metadata = await sharp(filePath).metadata();
        return {
            width: metadata.width,
            height: metadata.height
        };
    } catch (error) {
        console.error('获取图片信息失败:', error);
        return null;
    }
}

async function getImagesRecursively(dir, searchTerm = '') {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let results = [];

    for (let entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(await getImagesRecursively(fullPath, searchTerm));
        } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext) && 
                (!searchTerm || entry.name.toLowerCase().includes(searchTerm))) {
                const relativePath = path.relative(path.join(__dirname, 'public'), fullPath);
                const imageInfo = await getImageInfo(fullPath);
                results.push({
                    path: '/' + relativePath.replace(/\\/g, '/'),
                    resolution: imageInfo ? `${imageInfo.width}x${imageInfo.height}` : 'Unknown'
                });
            }
        }
    }

    return results;
}

app.get('/get-images', async (req, res) => {
    const searchTerm = req.query.search ? req.query.search.toLowerCase() : '';
    const imagesDir = path.join(__dirname, 'public', 'images');
    
    try {
        const imagePaths = await getImagesRecursively(imagesDir, searchTerm);
        res.json(imagePaths);
    } catch (error) {
        console.error('读取图片目录失败:', error);
        res.status(500).json({ error: '无法读取图片目录' });
    }
});

app.post('/upload', upload.array('images', 10), (req, res) => {
    if (req.files && req.files.length > 0) {
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

app.listen(PORT, () => {
    console.log(`服务器运行在 ${BASE_URL}`);
});
