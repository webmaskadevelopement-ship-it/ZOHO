const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/public/app.js');
let content = fs.readFileSync(filePath, 'utf8');

// Remove duplicate declaration of tbody and totalCountEl
const targetDup = `    const tasks = res.data || [];
    allTasksCache = tasks;
    const taskLists = (tlRes && tlRes.success && Array.isArray(tlRes.data)) ? tlRes.data : allTaskListsCache;
    allTaskListsCache = taskLists;

    const tbody = document.getElementById('taskSheetTbody');
    const totalCountEl = document.getElementById('taskSheetTotalCount');
    if (totalCountEl) totalCountEl.innerHTML = \`<span>Total Count : <strong style="color:var(--text-primary); margin-left:4px;">\${tasks.length}</strong></span>\`;`;

const cleanCode = `    const tasks = res.data || [];
    allTasksCache = tasks;
    const taskLists = (tlRes && tlRes.success && Array.isArray(tlRes.data)) ? tlRes.data : allTaskListsCache;
    allTaskListsCache = taskLists;

    if (totalCountEl) totalCountEl.innerHTML = \`<span>Total Count : <strong style="color:var(--text-primary); margin-left:4px;">\${tasks.length}</strong></span>\`;`;

if (content.includes(targetDup)) {
    content = content.replace(targetDup, cleanCode);
    console.log('✓ Removed duplicate tbody declaration');
} else {
    const norm = content.replace(/\r\n/g, '\n');
    if (norm.includes(targetDup)) {
        content = norm.replace(targetDup, cleanCode);
        console.log('✓ Removed duplicate tbody declaration (normalized CRLF)');
    } else {
        console.warn('⚠️ Could not match duplicate pattern exactly');
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Saved app.js');

