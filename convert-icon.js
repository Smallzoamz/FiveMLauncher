const toIco = require('to-ico');
const fs = require('fs');

async function convert() {
    try {
        const png = fs.readFileSync('assets/icon_clean.png');
        const ico = await toIco([png]);
        fs.writeFileSync('assets/icon.ico', ico);
        console.log('ICO created successfully!');
    } catch (e) {
        console.error('Error:', e);
    }
}

convert();
