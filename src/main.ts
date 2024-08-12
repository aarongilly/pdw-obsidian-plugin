import fs from 'fs';
import path from 'path';
import * as pdw from 'pdw';
import { testData } from './real-data/real-data.js';
import Outline from './Outline.js';
import Note from './Note.js'
import { ObsidianAsyncDataStore } from './obsidianDatastore.js';

// const matter = require('gray-matter'); // for parsing frontmatter

const vaultPath = '/Users/aaron/Desktop/Journal Island';
const configFileSubpath = "PDW/PDW Config.md"
const outputPath = '/Users/aaron/Desktop/Output';

// let pdwRef = pdw.PDW.getInstance();
// await pdwRef.setDefs(testData);

let ODS = new ObsidianAsyncDataStore(vaultPath, configFileSubpath);

/** Loads config... maybe other things */
// initObsidianPlugin();

function initObsidianPlugin(){
    //find config file
    const configFilePath = vaultPath + "/" + configFileSubpath;
    const configFile = fs.readFileSync(configFilePath, 'utf8');

    // let appendText = '';
    // pdwRef.manifest.forEach(def=>{
    //     appendText += '\n- [' + def.did + "::" + def.lbl.replaceAll(' ','_') + ']'
    //     def.pts.forEach(point=>{
    //         appendText += '\n\t- [' + point.pid + '::' + point.lbl.replaceAll(' ','_') + ']';
    //     })
    // })

    // const newContent = configFile + appendText;
    // fs.writeFileSync(configFilePath, newContent, 'utf-8')

    // const configOutline = new Outline(configFile);
}

/**
 * A bullet. A PDW bullet, specifically. Starting with "- #pdw", 
 * with indented lines starting with "	- "
 * Don't have more than one dataview property per line
 */
class Bullet {
    raw: string;
    date: string;
    updated: string;
    time: any;
    note: any;
    type: any;
    period: any;
    attributes: { [x: string]: any };
    constructor(rawInput: string, dateStr: string, updatedStr: string) {
        this.raw = rawInput;
        this.date = dateStr;
        this.updated = updatedStr;
        this.time = this.parseTime();
        this.note = this.parseNote();
        this.type = this.getType(); //not used right now
        this.period = this.date;
        if (this.time !== undefined) this.period = this.date + "T" + this.time;

        this.attributes = [];
        return this;
    };

    getType() { //not being used for PDW-specific stuff, which is what I'm doing right now
        // const firstFive = this.raw.substring(0,5);
        // if(firstFive === '- [ ]') return this.type = "Incomplete Task";
        // if(firstFive === '- [x]' || firstFive === '- [X]') return this.type = "Complete Task";
        // let taskRegex = /^-\s\[.\]\s.*$/;
        // if(taskRegex.test(this.raw.substring(0,5))) return this.type = 'Task';
        const splitOnPDW = this.raw.split('#pdw/');
        // if(splitOnPDW.length === 1) return this.type = 'General';
        if (splitOnPDW.length === 2) return splitOnPDW[1].split(' ')[0];
        throw new Error('This ever happen?');
    }

    addIndentedBullet(rawChunk: string) {
        this.raw = this.raw + "\n" + rawChunk;
        let attribute = Bullet.parseAttributeFromText(rawChunk);
        if (attribute !== undefined) this.attributes.push(attribute);
    }

    parseTime() {
        if (this.raw.length < 7) return undefined;
        const timeRegex = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
        const timeSpot = this.raw.substring(2, 7);
        if (timeRegex.test(timeSpot)) return timeSpot;
        return undefined;
    }

    parseNote() {
        const afterTagContent = this.raw.split('#pdw')[1];
        const afterSubtagContent = afterTagContent.split(' ');
        afterSubtagContent.shift(); //remove first word
        return afterSubtagContent.join(' ');
    }

    static parseAttributeFromText(textIn: string) {
        const split = textIn.split('::');
        if (split.length === 1) return undefined;
        if (split.length > 2) throw new Error("One attribute per line!");
        const doubleSplit = split[0].split('[');
        const key = doubleSplit[doubleSplit.length - 1];
        let val = '%%UNFOUNDERROR%%';
        const fullValText = split[1];
        //reduce down to just the part before the matching "]"
        let closingBracketsNeeded = 1;
        for (let i = 0; i < fullValText.length; i++) {
            if (fullValText[i] === "[") closingBracketsNeeded += 1;
            if (fullValText[i] === "]") closingBracketsNeeded -= 1;
            if (closingBracketsNeeded === 0) {
                val = fullValText.substring(0, i);
                i = fullValText.length //end loop
            }
        }
        return { [key]: val }
    }
}

let templateLocation = getTemplateLocation();
let attachmentLocation = getAttachmentFolderPath();

// let markdownFiles: any[] = [];
let bullets: Bullet[] = [];
let notes: Note[] = [];

recursivelyAddToNotesList(vaultPath + "/Periods/1 - Daily");

//markdownFiles.forEach(file => parseMarkdownFile(file));
console.log(bullets);

function getTemplateLocation() {
    //@ts-expect-error
    return JSON.parse(fs.readFileSync(vaultPath + "/.obsidian/templates.json")).folder;
}

function getAttachmentFolderPath() {
    //@ts-expect-error
    return JSON.parse(fs.readFileSync(vaultPath + "/.obsidian/app.json")).attachmentFolderPath;
}

function recursivelyAddToNotesList(pathIn: string) {
    const pathNames = fs.readdirSync(pathIn);

    pathNames.forEach(fileName => {
        const filePath = pathIn + "/" + fileName;
        const fileStats = fs.statSync(filePath)

        /* Resurse for folders */
        if (fileStats.isDirectory()) {
            if (fileName.substring(0, 1) == ".") {
                // parseObsidianDirectory(filePath)
                return //don't step into `.obsidian` directory
            }
            if (fileName === templateLocation) return; //don't parse templates
            if (fileName.toUpperCase() === attachmentLocation.toUpperCase()) return; //don't parse templates
            
            recursivelyAddToNotesList(filePath);
        }
        /* Ignore non-files */
        if (fs.statSync(filePath).isFile() == false) return

        /* Ignore non-markdown files */
        if (path.extname(fileName) !== '.md') return

        notes.push(Note.parseFromPath(filePath))
        // markdownFiles.push({ [filePath]: fs.readFileSync(filePath, 'utf8') });
    })
}

function parseMarkdownFile(mdFile: any) {
    const filePath = Object.keys(mdFile)[0];
    const fileName = filePath.split('/')[filePath.split('/').length - 1];
    const stats = fs.statSync(filePath);
    if (!stats.isFile() || path.extname(filePath) !== '.md') {
        console.warn('What is this file?', mdFile);
        return
    }

    const file = fs.readFileSync(filePath, 'utf8');

    /* Break to chunks on new line */
    let chunks = file.split(/\r?\n/);

    /* 
        For now (at least) only going to support proper bullets & one-level indentation.
        Also going to only support my typical bullet styling... which is definitely one of many.
        So: "- " will be recognized, but " - " won't. "* " won't. etc.
    */

    const bulletEndToken = '	- ';
    let currentBullet = undefined;
    while (chunks.length > 0) {
        const thisChunk = chunks.shift()!;
        if (thisChunk.substring(0, 2) !== "- " && thisChunk.includes("#pdw")) {
            console.warn("Skipping bullet marked with #pdw", thisChunk)
            continue;
        }
        if (!thisChunk.includes("#pdw") && currentBullet === undefined) continue
        if (thisChunk.substring(0, 2) === "- " && thisChunk.includes("#pdw")) {
            if (currentBullet !== undefined) bullets.push(currentBullet);
            const updateTime = getZonelessISOString(stats.mtime);
            const alt = stats.mtime.toLocaleTimeString();
            currentBullet = new Bullet(thisChunk, fileName.substring(0, fileName.length - 3), Math.round(stats.mtimeMs).toString(36));
            continue;
        }
        if (currentBullet === undefined) throw new Error('ERPIAAIRP')
        if (thisChunk.substring(0, 3) === '	- ') {
            currentBullet.addIndentedBullet(thisChunk);
        }
    }
}

function getZonelessISOString(date: string | Date) {
    // Create a new Date object to avoid modifying the original
    const localDate = new Date(date);

    // Extract date components
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');

    // Extract time components
    const hours = String(localDate.getHours()).padStart(2, '0');
    const minutes = String(localDate.getMinutes()).padStart(2, '0');
    const seconds = String(localDate.getSeconds()).padStart(2, '0');
    const milliseconds = String(localDate.getMilliseconds()).padStart(3, '0');

    // Combine components into ISO 8601 format
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
}

// function parseObsidianDirectory(pathIn) {
//     const pathNames = fs.readdirSync(pathIn);
//     pathNames.forEach(filePath => {
//         const filePath = pathIn + "/" + fileName;
//         const fileStats = fs.statSync(filePath)

//         const file = fs.readFileSync(pathIn+"/"+filePath, 'utf8');
//         if(filePath.split('.')[1]==='json'){
//             let obj = JSON.parse(file);
//             console.log(obj);
//         }
//         console.log(file);
//     })
//     const file = fs.readFileSync(pathIn + "/templates.json");
//     const obj = JSON.parse(file);
//     templateLocation = obj.folder;
// }


// // Parse YAML frontmatter
// const parsedContent = matter(fileContents);
// const frontmatter = parsedContent.data;
// const body = parsedContent.content;

// frontmatter.permalink = pathName.substring(0,pathName.length - 3);
// frontmatter.aliases = [title, title.split('-')[0].trim()]

// Remove "summary" property from frontmatter
// delete frontmatter.modified_time;
// frontmatter.aliases = 

// String replacement logic
// const modifiedContents = matter.stringify(body,frontmatter)
//parsedContent.toString(); // BARD GONE HALLUCINATING AGAIN

// if (modifiedContents !== fileContents) {
//     console.log('test')
//     // Content has been modified, write it back to the file
// fs.writeFile(outputPath + "/" + pathName, modifiedContents, 'utf8', (err) => {
//     if (err) {
//         console.error('Error writing file:', err);
//         return;
//     }
//     console.log('Target string replaced and "summary" property removed in file:', pathName);
// });
// } else {
//     console.log('Target string not found in file:', filePath);
// }


/*
    let configAppendString = ''

    pdwRef.manifest.forEach(def=>{
        const pointlessCopy = JSON.parse(JSON.stringify(def.data));
        delete pointlessCopy._pts
        configAppendString += "\n## " + def.lbl.replaceAll(' ','_')
        configAppendString += "\n```json\n" 
        configAppendString +=  JSON.stringify(pointlessCopy, null, '\t')
        configAppendString += "\n```" 
        def.pts.forEach(pointDef=>{
            configAppendString += "\n### " + pointDef.lbl.replaceAll(' ','_');
            configAppendString += "\n```json\n";
            configAppendString += JSON.stringify(pointDef.data,null,'\t');
            configAppendString += "\n```" 
        })
    })

    const newContent = configFile + configAppendString;

    fs.writeFileSync(configFilePath, newContent, 'utf-8')
    */