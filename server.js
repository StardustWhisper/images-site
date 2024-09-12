const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = 3000;

app.use(express.static('public'));

async function getImagePaths(dir) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
    let results = [];

    const files = await fs.readdir(dir, { withFileTypes: true });

    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            results = results.concat(await getImagePaths(fullPath));
        } else if (imageExtensions.includes(path.extname(file.name).toLowerCase())) {
            results.push(fullPath);
        }
    }

    return results;
}

app.get('/get-images', async (req, res) => {
    try {
        const imagePaths = await getImagePaths('public/images');
        res.json(imagePaths.map(p => p.replace('public', '')));
    } catch (error) {
        console.error('获取图片路径时出错:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});
