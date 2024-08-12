
import type { EntryData } from "pdw";

export type BlockType = 
    "text" |
    "h1" |
    "h2" |
    "h3" |
    "h4" |
    "h5" |
    "h6" |
    "openTask" |
    "completedTask" |
    "otherTask" |
    "ol" |
    "ul" |
    "blockQuote" |
    "codeBlock" |
    "pdwEntry" | 
    "empty"

/**
 * Breaks a string into a series of blocks, attempting to replicate
 * Obsidian's standard behavior for block ID handling.
 */
export default class Block {
    text: string;
    type: BlockType;

    private constructor(text: string) {
        this.text = text;
        this.type = Block.determineType(this.text);
    }

    /**
     * Grabs all Dataview-formatted key-value pairs contained in block, 
     * presents them in order.
     */
    getProps(): {[key:string]: string}[] {
        let returnArr:{[key:string]: string}[] = [];
        const splitText = this.text.split('::');
        if(splitText.length === 1) return returnArr;
        let key: string
        let val: any
        splitText.forEach(chunk=>{
            if(key !== undefined){
                val = chunk.split(']').shift();
                returnArr.push({[key]:val});
            }
            key = chunk.split('[').pop()!;
        })
        return returnArr;
    }

    static splitStringToBlockArray(text: string, includeEmptyBlocks = true) {
        const blocks: string[] = [];
        const lines = text.split('\n');

        let currentBlock = '';
        let inCodeBlock = false;
        let inQuote = false;
        let inList = false;

        lines.forEach(line => {
            const trimmedLine = line.trim();
            const upToFirstSpace = trimmedLine.split(' ')[0];

            if(trimmedLine.startsWith('^') && !trimmedLine.includes(' ')){
                //whole line is a block ID for the block before it
                currentBlock += line.trim() + '\n';
            } else if (inCodeBlock) {
                if (trimmedLine === '```') {
                    inCodeBlock = false;
                    blocks.push(currentBlock.trim());
                    currentBlock = '';
                } else {
                    currentBlock += line + '\n';
                }
            } else if (inQuote) {
                if (!trimmedLine.startsWith('>')) {
                    inQuote = false;
                    blocks.push(currentBlock.trim());
                    currentBlock = '';
                } else {
                    currentBlock += line.trim() + '\n';
                }
            } else if (inList) {
                if (!line.startsWith(' ') && !line.startsWith('\t')) {
                    inList = (/^[-*]$/.test(upToFirstSpace) || /^\d+[.)]$/.test(upToFirstSpace));
                    blocks.push(currentBlock.trim());
                    currentBlock = line.trim() + '\n';
                } else {
                    currentBlock += line.trim() + '\n';
                }
            } else {
                if (trimmedLine === '') {
                    // Blank line, end of block
                    blocks.push(currentBlock.trim());
                    currentBlock = '';
                } else if (/^#{1,6}$/.test(line.split(' ')[0])) {
                    //is heading
                    blocks.push(currentBlock.trim());
                    blocks.push(line); //heading blocks always only one line
                    currentBlock = '';
                } else if (/^[-*]$/.test(upToFirstSpace) || /^\d+[.)]$/.test(upToFirstSpace)){
                    // in an ol or ul block, each same-level block is a new block
                    // only indentations beyond current level remain part of the same block
                    inList = true;
                    blocks.push(currentBlock.trim());
                    currentBlock += line + '\n';
                } else if (trimmedLine.startsWith('```')) {
                    inCodeBlock = true;
                    blocks.push(currentBlock.trim());
                    currentBlock = line + '\n';
                } else if (trimmedLine.startsWith('>')) {
                    inQuote = true;
                    blocks.push(currentBlock.trim());
                    currentBlock = line.trim() + '\n';
                } else {
                    currentBlock += line + '\n';
                }
            }
        });

        // Handle the last block if it doesn't end with a blank line
        if (currentBlock.trim() !== '') {
            blocks.push(currentBlock.trim());
        }


        //handle empty first block where there isn't really one, which happens
        if(blocks[0] === '' && !text.startsWith('\n')) {
            blocks.shift();
        }

        // Remove empty blocks
        if (includeEmptyBlocks) {
            return blocks.map(block=>new Block(block));
        }

        return blocks.filter(block => block.trim() !== '').map(block=>new Block(block));
    }

    static determineType(text: string): BlockType{
        const trimmedText = text.trim();
        const upToFirstSpace = trimmedText.split(' ')[0]
        if(trimmedText.includes('#pdw')) return "pdwEntry"
        if(trimmedText.startsWith('# ')) return 'h1'
        if(trimmedText.startsWith('## ')) return 'h2'
        if(trimmedText.startsWith('### ')) return 'h3'
        if(trimmedText.startsWith('#### ')) return 'h4'
        if(trimmedText.startsWith('##### ')) return 'h5'
        if(trimmedText.startsWith('###### ')) return 'h6'
        if(trimmedText.startsWith('- [ ] ')) return 'openTask'
        if(trimmedText.startsWith('- [x] ')) return 'completedTask'
        if(/^- \[[a-zA-Z0-9]]$/.test(upToFirstSpace)) return 'otherTask'
        if(/^\d+[.)]$/.test(upToFirstSpace)) return 'ol'
        if(/^[-*]$/.test(upToFirstSpace)) return 'ul'
        if(trimmedText.startsWith('```')) return 'codeBlock'
        if(trimmedText.startsWith('>')) return 'blockQuote'
        if(trimmedText === '') return "empty"
        return 'text'
    }
}