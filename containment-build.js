const fs=require('fs');fs.rmSync('containment-public',{recursive:true,force:true});fs.mkdirSync('containment-public');fs.copyFileSync('preview.html','containment-public/index.html');
