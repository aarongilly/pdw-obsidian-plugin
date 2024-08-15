import * as pdw from 'pdw'
import fs from 'fs'
import path from 'path'
import Block from './Blocks.js';
import Note from './Note.js';

type defMap = {
    did: string,
    label: string,
    points: { pid: string, label: string }[]
}
type config = {
    tag: string;
    daily: string;
    weekly?: string;
    monthly?: string;
    quarterly?: string;
    yearly?: string;
    defMap: defMap[]
}

export class ObsidianAsyncDataStore implements pdw.AsyncDataStore {
    vaultPath: string;
    dailyFolder: string;
    topTag: string;
    weeklyFolder?: string;
    monthlyFolder?: string;
    quarterlyFolder?: string;
    yearlyFolder?: string;
    defMap: defMap[];
    /**
     * This is the constructor
     * @param vaultPath 
     * @param configFileSubpath 
     */
    constructor(vaultPath: string, configFileSubpath: string) {
        const configFilePath = vaultPath + "/" + configFileSubpath;
        const configFile = fs.readFileSync(configFilePath, 'utf8');
        if (!this.isValidConfig(configFile)) throw new Error('Config File did not look right. Run ObsidianAsyncDataStore.logConfigFileTemplate() to see what it should look like.');
        this.vaultPath = vaultPath;
        const config = this.parseConfig(configFile);
        this.dailyFolder = config.daily;
        this.weeklyFolder = config.weekly;
        this.monthlyFolder = config.monthly;
        this.quarterlyFolder = config.quarterly;
        this.yearlyFolder = config.yearly;
        this.topTag = config.tag;
        this.defMap = config.defMap;
        console.log('Obsidian PDW config loaded!')
    }

    async importFrom(): Promise<pdw.CompleteDataset> {
        //traverse folders, accumulate Blocks
        const foldersToTraverse = [this.dailyFolder];
        if (this.weeklyFolder !== undefined) foldersToTraverse.push(this.weeklyFolder);
        if (this.monthlyFolder !== undefined) foldersToTraverse.push(this.monthlyFolder);
        if (this.quarterlyFolder !== undefined) foldersToTraverse.push(this.quarterlyFolder);
        if (this.yearlyFolder !== undefined) foldersToTraverse.push(this.yearlyFolder);

        const notes: Note[] = [];
        foldersToTraverse.forEach(folderName => {
            recursivelyAddToNotesList(this.vaultPath + "/" + folderName);
        })

        const entryData: pdw.EntryData[] = [];
        const that = this; //for use in functions without passing.
        notes.forEach(note => {
            note.blocks.forEach(block => {
                if (blockIsEntry(block)) {
                    entryData.push(blockToEntry(block, note));
                }
            })
        })
        
        await pdw.PDW.getInstance().setEntries([], entryData);

        let returnObj: pdw.CompleteDataset ={
            defs: [],
            entries: entryData
        }

        return returnObj;
        
        function recursivelyAddToNotesList(pathIn: string) {
            const pathNames = fs.readdirSync(pathIn);

            pathNames.forEach(fileName => {
                const filePath = pathIn + "/" + fileName;
                const fileStats = fs.statSync(filePath)

                /* Resurse for folders */
                if (fileStats.isDirectory()) {
                    recursivelyAddToNotesList(filePath);
                }
                /* Ignore non-files */
                if (fs.statSync(filePath).isFile() == false) return

                /* Ignore non-markdown files */
                if (path.extname(fileName) !== '.md') return

                notes.push(Note.parseFromPath(filePath))
            })
        }

        function blockIsEntry(block: Block): boolean {
            const firstLine = block.text.split('\n')[0];
            return firstLine.includes('#' + that.topTag);
        }

        function blockToEntry(block: Block, note: Note): pdw.EntryData {
            const altArray: {key: string, value: any}[] = [];
            const props: any = {};
            block.props.forEach(kv=>{
                const key = Object.keys(kv)[0]//.toUpperCase();
                const value = kv[key];
                props[key] = value;
                altArray.push({key: key, value: value});
            });

            const entryTypeLabel = pdwSubTag(block.text);
            if (entryTypeLabel === undefined) throw new Error('Entry Type Label was not found')

            let defMap = that.defMap.find(defKeyVal =>
                defKeyVal.label.toUpperCase() === entryTypeLabel?.toUpperCase()
            );

            if (defMap === undefined) {
                console.warn('No DefMap found for ' + entryTypeLabel);
                defMap = {
                    did: entryTypeLabel,
                    label: entryTypeLabel,
                    points: []
                }
            }

            let id = block.id;
            if (id === undefined) {
                id = mkId();
                console.warn("Block without ID in " + note.fileName + ". Made id for it: " + id)
            }

            //PROPS ARE AN ARRAY, NOT AN OBJECT. SHIT

            let eid = props.eid;
            if (eid === undefined) {
                eid = id;
            } else {
                delete props.eid
            }

            let period = note.fileNameNoExtension;
            if (period === undefined) throw new Error('No filename?');
            const time = blockTime(block.text);
            if (time !== undefined) period = period + "T" + time;

            let created = props.created;
            if (created === undefined) {
                created = note.stats.ctime.getTime().toString(36);
            } else {
                delete props.created
            }

            let updated = props.updated;
            if (updated === undefined) {
                updated = note.stats.mtime.getTime().toString(36);
            }else {
                delete props.updated
            }

            let source = props.source;
            if (source === undefined) {
                source = ''
            }else {
                delete props.source
            }

            let entryNote = props.note;
            if (entryNote === undefined) {
                entryNote = ''
            }else {
                delete props.note
            }

            let newEntryData: pdw.EntryData = {
                _eid: eid,
                _note: entryNote,
                _period: period,
                _did: defMap.did,
                _source: source,
                _uid: id,
                _deleted: false,
                _created: created,
                _updated: updated,
            }

            /* For all remaining props, find associated _pid */
            Object.keys(props).forEach((key:any)=>{
                const keyUpper = key.toUpperCase();
                const match = defMap.points.find((pt:any)=>
                    pt.label.toUpperCase() === keyUpper
                )
                let pid = key;
                if(match === undefined){
                    console.warn('No matching pid found under ' + defMap.label + ' for point labeled ' + key + ' in file ' + note.fileName);
                }else{
                    pid = match.pid
                }
                newEntryData[pid] = props[key]
            })

            return newEntryData


            function blockTime(blockText: string): string | undefined {
                const possibleTimes = blockText.split('\n')[0].match(/([01][0-9]|2[0-3]):[0-5][0-9]/g);
                if (possibleTimes === null) return undefined;
                if (possibleTimes!.length > 1) {
                    // console.warn('Multiple time values are present in block, defaulting to the first. Block text: ',this.text);
                }
                return possibleTimes[0];
            }

            function mkId(len = 3) { return new Date().getTime().toString(36) + "-" + Math.random().toString(36).slice(13 - len).padStart(len, "0") }

            function pdwSubTag(blockText: string): string | undefined {
                const firstLine = blockText.split('\n')[0];
                if (!firstLine.includes('#' + that.topTag)) {
                    throw new Error('No "' + that.topTag + '" tag was found in block.')
                }
                let words = firstLine.split(' ');
                let tagText: string | undefined;
                words.forEach(word => {
                    if (tagText !== undefined) return
                    if (word.startsWith('#' + that.topTag + '/')) tagText = word;
                })
                //full tag captured, including "#pdw/", splitting to get subtag
                return tagText?.split('/')[1]
            }
        }
    }
    /**
     * Write to an Obsidian folder
     * @param allData 
     * @param params 
     */
    exportTo(allData: pdw.CompleteDataset, params: any) {
        throw new Error('Method not implemented.');
    }




    /**
     * If the first line has something that looks like a time, this grabs that value.
    */
    /*
    get time(): string | undefined{
        const possibleTimes = this.text.split('\n')[0].match( /([01][0-9]|2[0-3]):[0-5][0-9]/g);
        if(possibleTimes === null) return undefined;
        if(possibleTimes!.length > 1){
            // console.warn('Multiple time values are present in block, defaulting to the first. Block text: ',this.text);
        }
        return possibleTimes[0];
    }

    get pdwTagText(): string | undefined {
        const firstLine = this.text.split('\n')[0];
        if(!firstLine.includes('#' + this.topTag)) return undefined;
        let words = firstLine.split(' ');
        let tagText: string | undefined;
        words.forEach(word=>{
            if(tagText !== undefined) return
            if(word.startsWith('#' + this.topTag + '/')) tagText = word;
        })    
        return tagText
    }

    get pdwSubTag(): string | undefined {
        const tagText = this.pdwTagText;
        if(tagText?.includes('/')) return tagText.split('/')[1];
        return undefined;
    }


    get note(): string | undefined {
        let returnStr = this.text.split('\n')[0];
        let time = this.time;
        let id = this.id;
        let pdwTagText = this.pdwTagText;
        let type = this.type;
        if(time !== undefined) returnStr = returnStr.replaceAll(time,'')
        if(id !== undefined) returnStr = returnStr.replaceAll("^" + id,'')
        if(pdwTagText !== undefined) returnStr = returnStr.replaceAll(pdwTagText,'')
        if(type !== 'text' && type !== 'empty') {
            let split = returnStr.split(' ')
            split.shift();
            returnStr = split.join(' ').trim();
        }
        if(returnStr === '') return undefined;
        return returnStr;
    }

    isEntry(): boolean {
        if(this.text.includes('#' + this.topTag)) return true;
        return false;
    }
        */

    // blockToEntryData(): ??
    // blockToEntry(): ??

    private parseConfig(text: string): config {
        let returnObj: config = {
            tag: '',
            daily: '',
            weekly: undefined,
            monthly: undefined,
            quarterly: undefined,
            yearly: undefined,
            defMap: []
        }
        const tagStart = text.indexOf('# Tag\n- [tag::');
        let tag = text.substring(tagStart + 14);
        returnObj.tag = tag.split(']')[0];
        const topHeadingArr = text.split('# ');

        const pathsText = topHeadingArr.filter(content => content.startsWith('Paths\n'))[0];
        const pathsBlocks = Block.splitStringToBlockArray(pathsText);
        pathsBlocks.forEach(block => {
            returnObj = { ...returnObj, ...block.props[0] }
        })

        const defsText = topHeadingArr.filter(content => content.startsWith('Defs\n'))[0];
        const defsBlocks = Block.splitStringToBlockArray(defsText);
        //@ts-expect-error
        returnObj.defMap = defsBlocks.map(defBlock => {
            let returnObj: defMap = {
                did: '',
                label: '',
                points: []
            }
            let props = defBlock.props;
            if (Object.keys(props).length === 0) return
            returnObj.did = Object.keys(props[0])[0];
            returnObj.label = props[0][returnObj.did];
            //remove the first one, it's for the def
            props.shift();
            //iterate over remaining ones, they're for points
            props.forEach(prop => {
                let pid = Object.keys(prop)[0];
                let label = prop[pid];
                returnObj.points.push({ pid: pid, label: label });
            })
            return returnObj
        })
        //remove any blocks that wound up with undefined values (blank lines, etc);
        returnObj.defMap = returnObj.defMap.filter(defMap => defMap !== undefined)

        return returnObj
    }

    static logConfigFileTemplate() {
        console.log(ObsidianAsyncDataStore.configTemplate);
    }

    private static configTemplate = `Configuration file contents, including this line if you want.
            # Tag
            [tag::pdw] %%don't include the hashtag%%
            # Paths
            - [daily::Periods/1 - Daily] %%required%%
            - [weekly::Periods/2 - Weekly]
            - [monthly::Periods/3 - Monthly]
            - [quarterly:: Periods/4 - Quarterly]
            - [yearly::Periods/5 - Yearly]
            # Defs
            - [hz44::New_Experiences] %%did::label to use in Obsidian%%
                - [4eiv::Thing] %%pid::label to use in Obsidian%%
            - [8mkn::Saw_Friends] %%did2... and so on
            `

    private isValidConfig(fileText: string): boolean {
        if (!fileText.includes('# Tag')) return false
        if (!fileText.includes('[tag::')) return false
        if (!fileText.includes('# Paths')) return false
        if (!fileText.includes('daily::')) return false
        if (!fileText.includes('# Defs')) return false
        return true
    }
} 