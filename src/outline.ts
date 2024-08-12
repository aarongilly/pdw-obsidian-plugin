/**
 * //#NOTE - This path sort of worked, had some trouble with 
 * handling improperly-leveled headings. Situations where
 * levels were out-of-order, or the common situation where
 * I don't have any h1s but **Do** have h2s was causing complications
 * 
 * Left this path just to do an array of blocks approach insteading of
 * a heading hierarchy. It's probably simpler that way.
 */

export default class Outline{
    /**
     * h1 = level 1
     * h2 = level 2
     * ...so on
     */
    level: number;
    /**
     * Probably don't use this.
     */
    _raw: string;
    /**
     * Hierarchy of headings
     */
    lowerHeadings: Outline[];
    /**
     * Text of the heading
     */
    title: string;
    /**
     * The text content of this level, not including lower levels.
     */
    thisLevelText: string;
    /**
     * The text content of this level, not including lower levels,
     * split into an array of blocks. Supports:
     * paragraphs
     * indentions
     * code blocks
     * quote blocks
     */
    thisLevelBlocks: string[];

    constructor(rawText: string, thisLevel?: number){
        this._raw = rawText;

        this.level = thisLevel ?? this.determineLevel();

        let delimiter = "\n" + '#'.repeat(this.level + 1) + " ";
        let splitByHeadings = rawText.split(delimiter);
        let upToNextHeading = splitByHeadings.shift()!;

        /* 
          //#NOTE - this worked, but had the effect of "promoting"
          out-of-order headers to force them to be correct, but
          I don't want that to happen. 
          
          Need to check all lower-level headings 
          to catch cases where heading levels are skipped 
          in the file (e.g. no h1, starts at h2)
        */
        // for(let i = this.level; i <= 6; i++) {
        //   let delimiter = "\n" + '#'.repeat(i + 1) + " ";
        //   let skipLevelHeadings = upToNextHeading.split(delimiter);
        //   if(skipLevelHeadings.length > 1){
        //     upToNextHeading = skipLevelHeadings.shift();
        //     splitByHeadings = [...skipLevelHeadings, ...splitByHeadings]
        //   }
        // }

        const byLine = upToNextHeading.split('\n');
        this.title = '';
        if(this.level !== 0) this.title = byLine.shift()!.trim();
        this.thisLevelText = byLine.join('\n');
        this.thisLevelBlocks = splitTextIntoBlocks(this.thisLevelText);

        this.lowerHeadings = splitByHeadings.map(headingText=>new Outline(headingText, this.level + 1));
    }

    private determineLevel(): number{
        if(this._raw.includes('\n# ')) return 0
        if(this._raw.includes('\n## ')) return 1
        if(this._raw.includes('\n### ')) return 2
        if(this._raw.includes('\n#### ')) return 3
        if(this._raw.includes('\n##### ')) return 4
        if(this._raw.includes('\n###### ')) return 5
        console.warn('No headings found, defaulting to h1');
        return 0
    }

    toString(): string{
      let returnStr = ''
      if(this.title !== ''){
        returnStr+= '#'.repeat(this.level) + " " + this.title + '\n';
      }
      returnStr += this.thisLevelText;
      this.lowerHeadings.forEach(heading=>{
        returnStr += heading.toString(); //recursively get heading content
      })
      return returnStr;
    }
}

function splitTextIntoBlocks(text: string, includeEmptyBlocks = true): string[] {
    const blocks: string[] = [];
    const lines = text.split('\n');
  
    let currentBlock = '';
    let isIndented = false;
    let inCodeBlock = false;
    let inQuote = false;
  
    lines.forEach(line => {
      const trimmedLine = line.trim();
  
      if (inCodeBlock) {
        if (trimmedLine === '```') {
          inCodeBlock = false;
          blocks.push(currentBlock.trim());
          currentBlock = '';
        } else {
          currentBlock += line + '\n';
        }
      } else if (inQuote) {
        if (!line.startsWith('>')) {
          inQuote = false;
          blocks.push(currentBlock.trim());
          currentBlock = '';
        } else {
          currentBlock += line.substring(1).trim() + '\n';
        }
      } else {
        if (trimmedLine === '') {
          // Blank line, end of block
          blocks.push(currentBlock.trim());
          currentBlock = '';
          isIndented = false;
        } else if (line.startsWith('```')) {
          inCodeBlock = true;
          blocks.push(currentBlock.trim());
          currentBlock = line + '\n';
        } else if (line.startsWith('>')) {
          inQuote = true;
          blocks.push(currentBlock.trim());
          currentBlock = line.substring(1).trim() + '\n';
        } else {//if (line.startsWith('  ') || line.startsWith('\t')) { // Assuming a two-space indent or tab
        //   // Indented line, add to current block
        //   currentBlock += line + '\n';
        //   isIndented = true;
        // } else if (isIndented) {
        //   // Continuation of indented block
        //   currentBlock += line + '\n';
        // } else {
        //   // New block or continuation of non-indented block
        //   if (currentBlock !== '') {
        //     blocks.push(currentBlock.trim());
        //   }
          currentBlock += line + '\n';
        //   isIndented = false;
        }
      }
    });
  
    // Handle the last block if it doesn't end with a blank line
    if (currentBlock.trim() !== '') {
      blocks.push(currentBlock.trim());
    }
    
    // Remove empty blocks
    if(includeEmptyBlocks){
        return blocks;
    }
    return blocks.filter(block=>block.trim() !== '');
  }