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
    get props(): {[key:string]: string}[] {
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

    /**
     * If any line ends with a "^somethingwithoutaspace", returns that
     */
    get id(): string | undefined{
        const lastWords = this.text.split('\n').map(line=>line.split(' ').pop());
        let possibleID: string | undefined = undefined;
        lastWords.forEach(word=>{
            if(possibleID !== undefined) return
            if(word?.startsWith('^')) possibleID = word.substring(1);
        })
        
        return possibleID;
    }

    static splitStringToBlockArray(text: string, includeEmptyBlocks = true, customTopTag = 'pdw'): Block[] {
        const blocks: string[] = [];
        const lines = text.split('\n');

        let currentBlock = lines.shift(); //remove first line, add to block list
        lines.forEach(line=>{
            /* This handles the line *after* code blocks */
            if(currentBlock === undefined){
                currentBlock = line;
                return;
            }
            /* Code Blocks cannot be handled via 2-line compare */
            if(currentBlock.trim()?.startsWith('```') && line.trim().startsWith('```')){
                currentBlock += '\n' + line;
                blocks.push(currentBlock!)
                currentBlock = undefined;
                return;
            }
            /* Do 2-line compare to determine if they're the same block */
            if(this.areSameBlock(currentBlock!, line)){
                currentBlock += '\n' + line;
            }else{
                blocks.push(currentBlock!)
                currentBlock = line;
            }
        })

        //and add remaining line to the end of the blocks
        if(currentBlock !== undefined) blocks.push(currentBlock);

        //#region ### Old Method
        // let currentBlock = '';
        // let inCodeBlock = false;
        // let inQuote = false;
        // let inList = false;

        // lines.forEach(line => {
        //     const trimmedLine = line.trim();
        //     const upToFirstSpace = trimmedLine.split(' ')[0];

        //     if(trimmedLine.startsWith('^') && !trimmedLine.includes(' ')){
        //         //whole line is a block ID for the block before it
        //         currentBlock += line.trim() + '\n';
        //     } else if (inCodeBlock) {
        //         if (trimmedLine === '```') {
        //             inCodeBlock = false;
        //             blocks.push(currentBlock.trim());
        //             currentBlock = '';
        //         } else {
        //             currentBlock += line + '\n';
        //         }
        //     } else if (inQuote) {
        //         if (!trimmedLine.startsWith('>')) {
        //             inQuote = false;
        //             blocks.push(currentBlock.trim());
        //             currentBlock = '';
        //         } else {
        //             currentBlock += line.trim() + '\n';
        //         }
        //     } else if (inList) {
        //         if (!line.startsWith(' ') && !line.startsWith('\t')) {
        //             inList = (/^[-*]$/.test(upToFirstSpace) || /^\d+[.)]$/.test(upToFirstSpace));
        //             blocks.push(currentBlock.trim());
        //             currentBlock = line.trim() + '\n';
        //         } else {
        //             currentBlock += line.trim() + '\n';
        //         }
        //     } else {
        //         if (trimmedLine === '') {
        //             // Blank line, end of block
        //             blocks.push(currentBlock.trim());
        //             currentBlock = '';
        //         } else if (/^#{1,6}$/.test(line.split(' ')[0])) {
        //             //is heading
        //             //#BUG - headings is sometimes picking up the next line, too.
        //             blocks.push(currentBlock.trim());
        //             blocks.push(line); //heading blocks always only one line
        //             currentBlock = '';
        //         } else if (/^[-*]$/.test(upToFirstSpace) || /^\d+[.)]$/.test(upToFirstSpace)){
        //             // in an ol or ul block, each same-level block is a new block
        //             // only indentations beyond current level remain part of the same block
        //             inList = true;
        //             blocks.push(currentBlock.trim());
        //             currentBlock += line + '\n';
        //         } else if (trimmedLine.startsWith('```')) {
        //             inCodeBlock = true;
        //             blocks.push(currentBlock.trim());
        //             currentBlock = line + '\n';
        //         } else if (trimmedLine.startsWith('>')) {
        //             inQuote = true;
        //             blocks.push(currentBlock.trim());
        //             currentBlock = line.trim() + '\n';
        //         } else {
        //             currentBlock += line + '\n';
        //         }
        //     }
        // });

        // // Handle the last block if it doesn't end with a blank line
        // if (currentBlock.trim() !== '') {
        //     blocks.push(currentBlock.trim());
        // }


        // //handle empty first block where there isn't really one, which happens
        // if(blocks[0] === '' && !text.startsWith('\n')) {
        //     blocks.shift();
        // }

        //#endregion

        // Remove empty blocks
        if (includeEmptyBlocks) {
            return blocks.map(block=>new Block(block));
        }

        return blocks.filter(block => block.trim() !== '').map(block=>new Block(block));
    }

    static determineType(text: string): BlockType{
        const trimmedText = text.trim();
        const upToFirstSpace = trimmedText.split(' ')[0];
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
    
    private static areSameBlock(firstLine: string, secondLine: string): boolean{
        //#NOTE - the order here was carefully chosen, don't mess it up.
        //Existing code blocks adopt all following lines (the end delimiter is handled elsewhere)
        const trimmedFirstLine = firstLine.trim()
        if(trimmedFirstLine.startsWith('```')) return true;
        //Empty lines are never combined with anything (outside of code blocks).
        if(firstLine === '' || secondLine === '') return false;
        //Block IDs are always combined with any non-empty block
        const trimmedSecondLine = secondLine.trim();
        if(trimmedSecondLine.startsWith('^') && !trimmedSecondLine.includes(' ')) return true;
        const firstLineFirstWord = firstLine.split(' ')[0]
        const secondLineFirstWord = secondLine.split(' ')[0]
        //Headers are always blocks of themselves
        if(/^#{1,6}$/.test(firstLineFirstWord) || /^#{1,6}$/.test(secondLineFirstWord)) return false;
        //Block quote continuations are the same block
        if(firstLine.startsWith('>') && trimmedSecondLine.startsWith('>')) return true;
        //New block quotes or Code Blocks always the start of a block
        if(trimmedSecondLine.startsWith('```') || trimmedSecondLine.startsWith('>')) return false;
        //New lists are always the start of a block
        if(secondLineFirstWord === '-' || secondLineFirstWord === '*' || /^\d+[.)]$/.test(secondLineFirstWord)) return false
        //Block Quotes only merge with other block quotes
        if(firstLine.startsWith('>') && !secondLine.startsWith('>')) return false;
        //Lists 
        if(firstLineFirstWord === '-' || firstLineFirstWord === '*' || /^\d+[.)]$/.test(firstLineFirstWord)){
            //Indention of second line means same block
            if(secondLine.startsWith(' ') || secondLine.startsWith('\t')) return true
            //No indention means new block
            return false;
        }
        //if the first line is a list, and the second line isn't an indentation, then 
        //you may be able to just return true at this point, but want to test
        if(Block.determineType(firstLine)==='text' && Block.determineType(secondLine) === 'text') return true;
        //should not hit this?
        throw new Error(`Line conversion to blocks was unhandled for lines:
            ${firstLine}
            ...and...
            ${secondLine}`);
    }
}