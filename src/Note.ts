import fs from 'fs'
import path from 'path'
import Block from './Blocks.js';

export default class Note{
    stats: fs.Stats;
    path: string;
    _rawContent: string;
    blocks: Block[];
    private constructor(filePath: string){
        this.stats = fs.statSync(filePath);
        if (!this.stats.isFile()) throw new Error('Provided path does not point to a file: ' + filePath);
        if (path.extname(filePath) !== '.md') throw new Error('File at path is not a Markdown file: ' + filePath);
        this.path = filePath;
        this._rawContent = fs.readFileSync(filePath,"utf-8");
        this.blocks = Block.splitStringToBlockArray(this._rawContent);        
    }

    get fileName(){
        const chunks = this.path.split('/');
        return chunks.pop();
    }

    get fileLocation(){
        const chunks = this.path.split('/');
        chunks.pop();
        return chunks.join('/');
    }

    get fileNameNoExtension(){
        let nameSplit = this.fileName?.split('.');
        nameSplit?.pop();
        return nameSplit?.join('.')
    }

    /**
     * There should be a method to sort the time-based notes to make sure they're in the correct order.
     * Also could do other things, but I'm not sure what yet.
     */
    standardize(){
        throw new Error("Method only ideated, not implemented")
    }

    static parseFromPath(filePath: string){
        return new Note(filePath);
    }

    static createAtPath(filePath: string, noteContents: string){
        
    }

    saveChanges(){

    }
}