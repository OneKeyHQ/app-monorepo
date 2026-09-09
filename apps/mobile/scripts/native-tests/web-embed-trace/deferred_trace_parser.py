"""Pure fixed-schema parser; never queries a device or reads arbitrary log files."""
import re
SUBSYSTEM = 'so.onekey.lavamoat.e2e'
CATEGORY = 'native-web-embed'
STAGES = frozenset('handler-init-start request-start read-begin read-complete delivery-enter delivery-discarded response-enter response-return data-enter data-return finish-enter finish-return request-stop handler-invalidate request-invalidated handler-dealloc source-changed load-request navigation-start navigation-commit navigation-finish navigation-failure process-terminated view-destroy view-fail-closed request-budget-exhausted event-budget-exhausted observation-window-ended'.split())
IDENTITY = r'run=([a-f0-9]{32}) manifest=([a-f0-9]{64}) '
EVENT = re.compile(r'OneKeyNativeWebEmbedDeferredV1 ' + IDENTITY + r'sequence=([0-9]+) timestampNs=([0-9]+) handler=([0-9]+) request=([0-9]+) stage=([a-z-]+) asset=(none|kaspa-loader|kaspa-sdk) elapsed=([0-9]+) bytes=([0-9]+) status=(-?[0-9]+) generation=([0-9]+) flags=([0-9]+)')
SUMMARY = re.compile(r'OneKeyNativeWebEmbedDeferredSummaryV1 ' + IDENTITY + r'snapshotStartElapsed=([0-9]+) snapshotEndElapsed=([0-9]+) flushElapsed=([0-9]+) flushTimestampNs=([0-9]+) reserved=([0-9]+) published=([0-9]+) unpublished=([0-9]+) dropped=([0-9]+) requestDropped=([0-9]+) windowMs=90000 capacity=256 requestLimit=16')

def parse(records, run, manifest, pid, launch_started_ns):
    if not re.fullmatch('[a-f0-9]{32}',run) or not re.fullmatch('[a-f0-9]{64}',manifest) or type(pid) is not int or pid<=0 or type(launch_started_ns) is not int or launch_started_ns<=0:
        raise ValueError('Invalid expected fixed identity')
    events={};summary=None
    for record in records:
        message=record.get('eventMessage')
        if not isinstance(message,str) or not message.startswith(('OneKeyNativeWebEmbedDeferredV1 ','OneKeyNativeWebEmbedDeferredSummaryV1 ')):
            continue
        if len(message)>700 or record.get('processID')!=pid or record.get('subsystem')!=SUBSYSTEM or record.get('category')!=CATEGORY:
            raise ValueError('Invalid fixed trace envelope')
        match=EVENT.fullmatch(message);kind='event'
        if not match:match=SUMMARY.fullmatch(message);kind='summary'
        if not match or match[1]!=run or match[2]!=manifest:
            raise ValueError('Invalid fixed trace schema or identity')
        values=match.groups()[2:]
        if kind=='summary':
            if summary is not None:raise ValueError('Duplicate native snapshot summary')
            summary=dict(zip(['snapshotStartElapsedMs','snapshotEndElapsedMs','flushElapsedMs','flushTimestampNs','reserved','published','unpublished','dropped','requestDropped'],map(int,values)))
            if not 65000<=summary['snapshotStartElapsedMs']<=summary['snapshotEndElapsedMs']<=summary['flushElapsedMs']<75000:
                raise ValueError('Native snapshot missed the unchanged observation window')
            if not launch_started_ns<=summary['flushTimestampNs']<launch_started_ns+75_000_000_000:
                raise ValueError('Native summary lies outside absolute launch observation')
            if summary['reserved']>256 or summary['published']+summary['unpublished']!=summary['reserved'] or summary['dropped']>65535 or summary['requestDropped']>65535:
                raise ValueError('Invalid native snapshot counters')
        else:
            seq,timestamp,handler,request,stage,asset,elapsed,size,status,generation,flags=values
            seq,timestamp,handler,request,elapsed,size,status,generation,flags=map(int,[seq,timestamp,handler,request,elapsed,size,status,generation,flags])
            if seq in events or not 0<=seq<256 or not 0<timestamp<2**64 or not 0<handler<2**64 or not 0<=request<=16 or stage not in STAGES or not 0<=elapsed<=90000 or not 0<=size<=64*1024*1024 or not -999<=status<=999 or not 0<=generation<=65535 or not 0<=flags<=31:
                raise ValueError('Invalid or duplicate native event fields')
            events[seq]={'sequence':seq,'timestampNs':str(timestamp),'handler':handler,'request':request,'stage':stage,'asset':asset,'elapsedMs':elapsed,'bytes':size,'status':status,'generation':generation,'flags':flags}
    if summary is None or len(events)!=summary['published'] or any(index>=summary['reserved'] for index in events):
        raise ValueError('Missing summary or lost/foreign snapshot records')
    if any(event['elapsedMs']>summary['snapshotEndElapsedMs'] for event in events.values()):
        raise ValueError('Event does not belong to the captured prefix')
    if not events or any(not launch_started_ns<=int(event['timestampNs'])<=summary['flushTimestampNs'] for event in events.values()):
        raise ValueError('Empty prefix or event outside the absolute launch/flush envelope')
    summary['flushTimestampNs']=str(summary['flushTimestampNs'])
    return {'records':[events[index] for index in sorted(events)],'summary':summary,
            'prefixComplete':summary['unpublished']==0 and summary['dropped']==0 and summary['requestDropped']==0,
            'intervalSampledReservationPrefix':True,'lateReservationsExcluded':True,'captureContinuesAfterSnapshot':True,'releaseEligible':False}

if __name__=='__main__':
    import copy,json
    run='1'*32;manifest='2'*64;pid=123;launch=1780000000000000000
    event=f'OneKeyNativeWebEmbedDeferredV1 run={run} manifest={manifest} sequence=0 timestampNs=1780000000000000000 handler=1 request=1 stage=read-complete asset=kaspa-sdk elapsed=100 bytes=15594038 status=200 generation=1 flags=0'
    summary=f'OneKeyNativeWebEmbedDeferredSummaryV1 run={run} manifest={manifest} snapshotStartElapsed=65001 snapshotEndElapsed=65001 flushElapsed=65002 flushTimestampNs=1780000065002000000 reserved=1 published=1 unpublished=0 dropped=0 requestDropped=0 windowMs=90000 capacity=256 requestLimit=16'
    source=[{'eventMessage':event,'processID':pid,'subsystem':SUBSYSTEM,'category':CATEGORY},{'eventMessage':summary,'processID':pid,'subsystem':SUBSYSTEM,'category':CATEGORY}]
    checks=0
    def require(ok):
        global checks
        if not ok:raise RuntimeError('Fixed parser test failed')
        checks+=1
    require(parse(source,run,manifest,pid,launch)['prefixComplete'])
    require(parse(source,run,manifest,pid,launch)['records'][0]['timestampNs']=='1780000000000000000')
    for changed in [event+' SECRET_SENTINEL',event.replace(run,'3'*32),event.replace('stage=read-complete','stage=unknown'),event.replace('flags=0','flags=32'),event.replace('request=1','request=17'),event.replace('sequence=0','sequence=256'),event.replace('1780000000000000000','1780000080000000000'),event.replace('1780000000000000000','1779999999999999999')]:
        bad=copy.deepcopy(source);bad[0]['eventMessage']=changed
        try:parse(bad,run,manifest,pid,launch)
        except ValueError:checks+=1
        else:raise RuntimeError('Invalid native event accepted')
    for bad in [source[:1],source[1:],source+[source[0]],source+[source[1]],[dict(source[0],processID=124),source[1]],[dict(source[0],subsystem='unrelated'),source[1]],[dict(source[0],category='unrelated'),source[1]]]:
        try:parse(bad,run,manifest,pid,launch)
        except ValueError:checks+=1
        else:raise RuntimeError('Incomplete native snapshot accepted')
    for changed in [summary.replace('flushElapsed=65002','flushElapsed=75000'),summary.replace('snapshotStartElapsed=65001','snapshotStartElapsed=64000'),summary.replace('published=1','published=2'),summary.replace('flushTimestampNs=1780000065002000000','flushTimestampNs=1780000075000000000'),summary.replace('snapshotEndElapsed=65001','snapshotEndElapsed=66000')]:
        bad=[source[0],dict(source[1],eventMessage=changed)]
        try:parse(bad,run,manifest,pid,launch)
        except ValueError:checks+=1
        else:raise RuntimeError('Invalid native summary accepted')
    for changed in [summary.replace('reserved=1','reserved=2').replace('unpublished=0','unpublished=1'),summary.replace('dropped=0','dropped=1'),summary.replace('requestDropped=0','requestDropped=1')]:
        require(not parse([source[0],dict(source[1],eventMessage=changed)],run,manifest,pid,launch)['prefixComplete'])
    print(json.dumps({'passed':True,'checks':checks,'scope':'Pure parser; no device or log collection'}))
