import pdw from 'pdw'
import fs from 'fs'
import path from 'path'
import Block from './Blocks.js';

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

/**
 * This is the class itself
 */
export class ObsidianAsyncDataStore implements pdw.AsyncDataStore {
    vaultPath: string;
    dailyFolder: string;
    topTap: string
    weeklyFolder?: string;
    monthlyFolder?: string;
    quarterlyFolder?: string;
    yearlyFolder?: string;
    defMap: defMap[]
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
        this.topTap = config.tag;
        this.defMap = config.defMap;
        console.log('Obsidian PDW config loaded!')
    }
    importFrom(params: any): Promise<pdw.CompleteDataset> {
        throw new Error('Method not implemented.');
    }
    /**
     * Write to an Obsidian folder
     * @param allData 
     * @param params 
     */
    exportTo(allData: pdw.CompleteDataset, params: any) {
        throw new Error('Method not implemented.');
    }

    private parseConfig(text: string): config {
        let returnObj: config = {
            tag: '',
            daily: '',
            weekly: '',
            monthly: '',
            quarterly: '',
            yearly: '',
            defMap: []
        }
        const tagStart = text.indexOf('# Tag\n- [tag::');
        let tag = text.substring(tagStart + 14);
        tag = tag.split(']')[0];
        const topHeadingArr = text.split('# ');

        const pathsText = topHeadingArr.filter(content => content.startsWith('Paths\n'))[0];
        const pathsBlocks = Block.splitStringToBlockArray(pathsText);
        pathsBlocks.forEach(block => {
            returnObj = { ...returnObj, ...block.getProps() }
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
            let props = defBlock.getProps();
            if(Object.keys(props).length === 0) return
            returnObj.did = Object.keys(props[0])[0];
            returnObj.label = props[0][returnObj.did];
            //remove the first one, it's for the def
            props.shift();
            //iterate over remaining ones, they're for points
            props.forEach(prop=>{
                let pid = Object.keys(prop)[0];
                let label = prop[pid];
                returnObj.points.push({pid: pid, label: label});
            })
            return returnObj
        })

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