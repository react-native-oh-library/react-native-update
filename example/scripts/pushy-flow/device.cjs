const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync, spawn} = require('node:child_process');
const {currentHash, rollbackEvidence} = require('./core.cjs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class Device {
  constructor(config, dir) { this.c = config; this.dir = dir; this.counter = 0; }
  hdc(...args) {
    return execFileSync(this.c.hdc || 'hdc', ['-t', this.c.device, ...args],
      {encoding:'utf8',timeout:args[0]==='install'?180000:30000,maxBuffer:16*1024*1024,windowsHide:true});
  }
  dump(label = 'current') {
    const remote = `/data/local/tmp/pushy-flow-${this.c.runId}.json`;
    this.hdc('shell','uitest','dumpLayout','-p',remote,'-b',this.c.bundleName);
    const file = path.join(this.dir, label + '-layout.json');
    this.hdc('file','recv',remote,file);
    const tree = JSON.parse(fs.readFileSync(file,'utf8'));
    const nodes = [];
    const walk = n => { nodes.push(n.attributes || {}); (n.children || []).forEach(walk); };
    walk(tree);
    const root = nodes.find(n => n.type === 'root' && n.bundleName === this.c.bundleName);
    this.bounds = (root?.bounds || tree.attributes.bounds).match(/\d+/g).map(Number);
    return nodes;
  }
  swipe(direction) {
    const [left, top, right, bottom] = this.bounds;
    const x = Math.round(left + (right-left)*0.88);
    const low = Math.round(top + (bottom-top)*0.82), high = Math.round(top + (bottom-top)*0.22);
    this.hdc('shell','uitest','uiInput','swipe',String(x),String(direction==='up'?high:low),String(x),String(direction==='up'?low:high),'1000');
  }
  find(id, direction = 'down') {
    for (let i=0;i<30;i++) {
      const nodes = this.dump();
      // Only cancel the known SDK download prompt; never accept an update here.
      const cancel = nodes.some(n => /是否下载|download.*update/i.test(n.text || ''))
        ? nodes.find(n => /^(取消|Cancel)$/.test(n.text || '') && n.visible === 'true') : undefined;
      if (cancel) {
        const b=cancel.bounds.match(/\d+/g).map(Number);
        this.hdc('shell','uitest','uiInput','click',String(Math.round((b[0]+b[2])/2)),String(Math.round((b[1]+b[3])/2)));
        continue;
      }
      const node = nodes.find(n => n.id === id && n.visible === 'true');
      if (node) {
        const b = node.bounds.match(/\d+/g).map(Number);
        if (b[3]-b[1]>40 && b[1]>this.bounds[1]+15 && b[3]<this.bounds[3]-30)
          return {x:Math.round((b[0]+b[2])/2),y:Math.round((b[1]+b[3])/2)};
      }
      if (i===14) direction = direction==='up'?'down':'up';
      this.swipe(direction);
    }
    throw new Error(`Cannot find ${id}; unlock device, close dialogs, and resume this stage`);
  }
  tap(id, direction) {
    const p=this.find(id,direction);
    this.hdc('shell','uitest','uiInput','click',String(p.x),String(p.y));
  }
  input(id,value,direction) {
    this.tap(id,direction);
    this.hdc('shell','uitest','uiInput','keyEvent','2072','2017');
    this.hdc('shell','uitest','uiInput','keyEvent','2055');
    this.hdc('shell','uitest','uiInput','text',value);
    this.hdc('shell','uitest','uiInput','keyEvent','Back');
    const nodes=this.dump();
    assert.equal(nodes.find(n=>n.id===id)?.text,value,`Input verification failed: ${id}`);
  }
  async coldStart() {
    assert(/success/i.test(this.hdc('shell','aa','force-stop',this.c.bundleName)), 'Force-stop failed');
    assert(/success/i.test(this.hdc('shell','aa','start','-a',this.c.ability,'-b',this.c.bundleName)), 'Start failed');
    await sleep(1500);
  }
  pid() {
    const pid = this.hdc('shell','pidof',this.c.bundleName).trim();
    assert(/^\d+$/.test(pid), 'Expected one application process');
    return pid;
  }
  snapshot(label) {
    const remote=`/data/local/tmp/pushy-flow-${this.c.runId}.jpeg`;
    this.hdc('shell','snapshot_display','-f',remote);
    this.hdc('file','recv',remote,path.join(this.dir,label+'.jpeg'));
  }
  async expectHash(hash,label) {
    for(let i=0;i<8;i++) {
      try { if(currentHash(this.dump(label))===hash) return; } catch {}
      await sleep(1000);
    }
    throw new Error(`Expected currentVersion=${hash}; inspect ${label}-layout.json`);
  }
  async download(version) {
    this.input('input-downloadFullUpdate-updateUrl',version.url,'down');
    this.input('input-downloadFullUpdate-hash',version.hash,'down');
    this.tap('test-downloadFullUpdate-btn','up');
    const deadline=Date.now()+(this.c.downloadTimeoutMs || 180000);
    while(Date.now()<deadline) {
      const nodes=this.dump('download-'+version.id);
      const result=nodes.find(n=>n.id==='result-downloadFullUpdate');
      if(result?.text==='Pass') return;
      if(result?.text?.startsWith('Error')) throw new Error(result.text);
      if(!result) this.swipe('down');
      await sleep(1000);
    }
    throw new Error('Download timed out');
  }
  async activate(version,label) {
    this.input('input-reloadUpdate-hash',version.hash,'up');
    this.tap('test-reloadUpdate-btn','up');
    await sleep(1500);
    await this.expectHash(version.hash,label);
    this.snapshot(label);
  }
  async healthy(version) {
    await this.coldStart();
    await this.download(version);
    await this.activate(version,'healthy-active');
    // Explicitly confirm only the known healthy version, never the rollback fixture.
    assert.equal(currentHash(this.dump()),version.hash);
    this.tap('test-markSuccess-btn','down');
    await sleep(1000);
    await this.coldStart();
    await this.expectHash(version.hash,'healthy-confirmed');
    return {hash:version.hash,pid:this.pid(),confirmed:true};
  }
  async rollback(normal,bad) {
    await this.healthy(normal);
    await this.download(bad);
    const fd=fs.openSync(path.join(this.dir,'continuous.log'),'w');
    const logger=spawn(this.c.hdc || 'hdc',['-t',this.c.device,'shell','hilog','-T','pushy'],
      {stdio:['ignore',fd,fd],windowsHide:true});
    const loggerDone = new Promise(resolve => { logger.once('exit',resolve); logger.once('error',resolve); });
    let loggerError;
    logger.on('error',e=>{loggerError=e;});
    try {
      await this.activate(bad,'test-active');
      const testPid=this.pid();
      const activatedAt=new Date().toISOString();
      assert(!loggerError, 'Continuous logger failed');
      await this.coldStart();
      await this.expectHash(normal.hash,'restored');
      const restoredPid=this.pid();
      assert.notEqual(testPid,restoredPid,'Process did not restart');
      const log=this.hdc('shell','hilog','-x','-P',restoredPid,'-T','pushy');
      fs.writeFileSync(path.join(this.dir,'restored.log'),log);
      const evidence=rollbackEvidence(log,restoredPid,bad.hash,normal.hash);
      assert(evidence,'No explicit rollback evidence in new process; not a PASS');
      this.snapshot('restored');
      return {testPid,restoredPid,activatedAt,evidence,restoredHash:normal.hash,scope:'Unconfirmed first launch, no crash injection'};
    } finally {
      logger.kill();
      await Promise.race([loggerDone,sleep(3000)]);
      fs.closeSync(fd);
    }
  }
}
module.exports={Device};
