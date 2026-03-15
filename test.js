const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('app.js', 'utf8');

const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: "http://localhost/"
});

// Mock jspdf and html2canvas and lucide
dom.window.jspdf = { jsPDF: class {} };
dom.window.html2canvas = async () => ({ toDataURL: () => '' });
dom.window.lucide = { createIcons: () => {} };

dom.window.onerror = function(msg, url, line, col, error) {
    console.error("RUNTIME ERROR AT LINE " + line + ":");
    console.error(msg);
    if (error && error.stack) console.error(error.stack);
};

dom.window.eval(script);

setTimeout(() => {
    console.log("Grid children count: ", dom.window.document.getElementById('grid-canvas').children.length);
    console.log("Palette children count: ", dom.window.document.getElementById('palette-grid').children.length);
    process.exit(0);
}, 1000);
