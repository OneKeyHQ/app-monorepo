#import <Foundation/Foundation.h>
#import <WebKit/WebKit.h>
#import <os/log.h>
#import <stdatomic.h>
#import <time.h>
#import <stdarg.h>
#import "TraceConfig.h"

static atomic_uint LogCount;
static atomic_bool SummaryDone;
static atomic_uint TimerCount;
static atomic_uint_fast64_t FakeNow;
static BOOL UseRealClock;
static BOOL UseRealTimer;
static BOOL InjectDuringFlush;
static dispatch_block_t TimerBlock;
static unsigned SnapshotReserved,SnapshotPublished,SnapshotUnpublished,SnapshotDropped,SnapshotRequestDropped;
static unsigned long long SnapshotElapsed,SnapshotEndElapsed,FlushElapsed,FlushTimestampNs;
static void *PublishTarget;
static unsigned HookMode,PendingSlot;
static void DuringPublishedLoad(void);
static NSMutableArray *Rows;
static NSMutableArray *Checks;
static void Require(BOOL ok,NSString *name){[Checks addObject:@{@"name":name,@"passed":@(ok)}];if(!ok)@throw [NSException exceptionWithName:@"FixedHarnessFailure" reason:name userInfo:nil];}
static uint64_t HarnessClock(clockid_t clock){
  if(UseRealClock)return clock_gettime_nsec_np(clock);
  uint64_t now=atomic_load_explicit(&FakeNow,memory_order_relaxed);
  return clock==CLOCK_REALTIME?1777777777000000000ULL+now:now;
}
static void HarnessAfter(dispatch_time_t when,dispatch_queue_t queue,dispatch_block_t block){
  atomic_fetch_add(&TimerCount,1);TimerBlock=[block copy];
  if(UseRealTimer)dispatch_after(when,queue,block);
}
static void Capture(const char *format,...);
#undef os_log_with_type
#define os_log_with_type(log,type,format,...) Capture(format,##__VA_ARGS__)
#define clock_gettime_nsec_np HarnessClock
#define dispatch_after HarnessAfter
#pragma push_macro("atomic_load_explicit")
#undef atomic_load_explicit
#define atomic_load_explicit(ptr,order) ({ __auto_type valuePtr=(ptr); if((void *)valuePtr==PublishTarget)DuringPublishedLoad(); __c11_atomic_load(valuePtr,order); })
#import "source/RNCOneKeyWebEmbedAssets.m"
#pragma pop_macro("atomic_load_explicit")
#undef clock_gettime_nsec_np
#undef dispatch_after

static void Emit(NSUInteger id){OKTraceEmit(id,id*2,RNCOneKeyTraceReadComplete,2,0,id*3,200,id*4,1);}
static void DuringPublishedLoad(void){
  PublishTarget=NULL;atomic_fetch_add(&FakeNow,123ULL*NSEC_PER_MSEC);
  if(HookMode==1){
    OKTraceRecords[PendingSlot]=(OKTraceRecord){.timestampNs=HarnessClock(CLOCK_REALTIME),.elapsedNs=0,.handler=77,.stage=RNCOneKeyTraceReadBegin};
    atomic_store_explicit(&OKTracePublished[PendingSlot],true,memory_order_release);
  }else if(HookMode==2)Emit(123);
}
static void Capture(const char *format,...){
  atomic_fetch_add_explicit(&LogCount,1,memory_order_relaxed);
  va_list args;va_start(args,format);
  const char *run=va_arg(args,const char *),*manifest=va_arg(args,const char *);
  if(strcmp(run,ONEKEY_MOBILE_LOCKDOWN_NATIVE_TRACE_RUN_ID)||strcmp(manifest,ONEKEY_MOBILE_LOCKDOWN_NATIVE_TRACE_MANIFEST))abort();
  if(strncmp(format,"OneKeyNativeWebEmbedDeferredSummaryV1 ",37)==0){
    SnapshotElapsed=va_arg(args,unsigned long long);SnapshotEndElapsed=va_arg(args,unsigned long long);FlushElapsed=va_arg(args,unsigned long long);FlushTimestampNs=va_arg(args,unsigned long long);
    SnapshotReserved=va_arg(args,unsigned);SnapshotPublished=va_arg(args,unsigned);SnapshotUnpublished=va_arg(args,unsigned);
    SnapshotDropped=va_arg(args,unsigned);SnapshotRequestDropped=va_arg(args,unsigned);
    atomic_store_explicit(&SummaryDone,true,memory_order_release);
  }else{
    unsigned sequence=va_arg(args,unsigned);unsigned long long timestamp=va_arg(args,unsigned long long);
    unsigned long long handler=va_arg(args,unsigned long long),request=va_arg(args,unsigned long long);
    const char *stage=va_arg(args,const char *),*asset=va_arg(args,const char *);
    unsigned long long elapsed=va_arg(args,unsigned long long),bytes=va_arg(args,unsigned long long);
    long long status=va_arg(args,long long);unsigned long long generation=va_arg(args,unsigned long long);unsigned flags=va_arg(args,unsigned);
    [Rows addObject:@{@"sequence":@(sequence),@"timestampNs":@(timestamp),@"handler":@(handler),@"request":@(request),@"stage":@(stage),@"asset":@(asset),@"elapsed":@(elapsed),@"bytes":@(bytes),@"status":@(status),@"generation":@(generation),@"flags":@(flags)}];
    if(InjectDuringFlush){InjectDuringFlush=NO;Emit(123);}
  }
  va_end(args);
}
static void Flush(void){dispatch_sync(dispatch_get_global_queue(QOS_CLASS_UTILITY,0),^{OKTraceFlush();});}
static RNCOneKeyWebEmbedAssets *Start(void){return [[RNCOneKeyWebEmbedAssets alloc]initWithBundle:NSBundle.mainBundle];}
static void BudgetClock(void){
  RNCOneKeyWebEmbedAssets *handler=Start();Require(handler!=nil,@"real helper initializes with exact native identity");
  unsigned before=atomic_load(&OKTraceEventCount);
  OKTraceEmit(1,1,(RNCOneKeyTraceStage)999,1,0,0,0,0,0);OKTraceEmit(1,1,RNCOneKeyTraceReadBegin,3,0,0,0,0,0);
  Require(atomic_load(&OKTraceEventCount)==before,@"unrecognized enum and asset cannot reserve slots");
  atomic_store(&FakeNow,OKTraceStartedNs+90ULL*NSEC_PER_SEC);Emit(7);
  Require(OKTraceRecords[before].stage==RNCOneKeyTraceReadComplete&&OKTraceRecords[before].elapsedNs==90ULL*NSEC_PER_SEC,@"90-second exact boundary remains allowed");
  atomic_fetch_add(&FakeNow,1);Emit(8);Emit(9);
  Require(OKTraceRecords[before+1].stage==RNCOneKeyTraceWindowEnded&&atomic_load(&OKTraceEventCount)==before+2,@"one window-ended marker then no later reservations");
  Require(atomic_load(&OKTraceDropped)==1,@"post-window event counted without affecting callers");
  atomic_store(&FakeNow,OKTraceStartedNs-1);Emit(10);
  Require(atomic_load(&OKTraceEventCount)==before+2&&atomic_load(&OKTraceDropped)==2,@"backward clock is bounded and cannot reopen capture");
  atomic_store(&OKTraceDropped,65534);OKTraceIncrementBounded(&OKTraceDropped);OKTraceIncrementBounded(&OKTraceDropped);
  Require(atomic_load(&OKTraceDropped)==65535,@"drop counter saturates without unsigned wrap");
  Require(atomic_load(&LogCount)==0&&atomic_load(&TimerCount)==1,@"clock edge paths never submit logs or extra timers");
}
static void Partial(void){
  RNCOneKeyWebEmbedAssets *handler=Start();Require(handler!=nil,@"helper initialized");
  Emit(5);unsigned pending=atomic_fetch_add_explicit(&OKTraceEventCount,1,memory_order_relaxed);
  InjectDuringFlush=YES;Flush();
  Require(SnapshotReserved==pending+1&&SnapshotPublished==pending&&SnapshotUnpublished==1,@"in-flight slot counted without reading unpublished data or blocking");
  Require(Rows.count==pending&&atomic_load(&OKTraceEventCount)==pending+2,@"event recorded during formatting is excluded from copied prefix");
  for(NSDictionary *row in Rows)Require([row[@"handler"] unsignedIntegerValue]!=123,@"later publication cannot leak into immutable snapshot");
  OKTraceRecords[pending]=(OKTraceRecord){.handler=55,.stage=RNCOneKeyTraceReadBegin};atomic_store_explicit(&OKTracePublished[pending],true,memory_order_release);
  unsigned logged=atomic_load(&LogCount);Flush();Require(atomic_load(&LogCount)==logged,@"late published slot cannot trigger a second dump");
  Emit(6);Require(atomic_load(&OKTraceEventCount)==pending+3,@"snapshot does not close original capture window");
}
static void Interval(void){
  RNCOneKeyWebEmbedAssets *handler=Start();Require(handler!=nil,@"helper initialized");
  if(HookMode==1){PendingSlot=atomic_fetch_add_explicit(&OKTraceEventCount,1,memory_order_relaxed);PublishTarget=&OKTracePublished[PendingSlot];}
  else PublishTarget=&OKTracePublished[0];
  unsigned prefix=atomic_load(&OKTraceEventCount);Flush();
  Require(SnapshotReserved==prefix&&SnapshotPublished==prefix&&SnapshotUnpublished==0,@"published counts describe the sampled prefix only");
  Require(SnapshotEndElapsed==SnapshotElapsed+123,@"snapshot interval exposes interleaved writer timing");
  if(HookMode==1){
    NSDictionary *late=Rows.lastObject;uint64_t base=1777777777000000000ULL+OKTraceStartedNs;
    Require([late[@"timestampNs"] unsignedLongLongValue]>base+SnapshotElapsed*NSEC_PER_MSEC&&[late[@"timestampNs"] unsignedLongLongValue]<=base+SnapshotEndElapsed*NSEC_PER_MSEC&&[late[@"elapsed"] unsignedLongLongValue]==0,@"reserved writer samples wall time after snapshot start while retaining its earlier hook-admission time");
  }else{
    Require(atomic_load(&OKTraceEventCount)==prefix+1&&Rows.count==prefix,@"reservation after prefix capture is excluded even when published before interval end");
    Require([Rows[0][@"handler"] unsignedLongLongValue]!=123,@"excluded late reservation is not mislabeled as an unpublished prefix slot");
  }
}
static void Concurrency(void){
  RNCOneKeyWebEmbedAssets *handler=Start();Require(handler!=nil,@"helper initialized");
  dispatch_group_t group=dispatch_group_create();dispatch_queue_t queue=dispatch_get_global_queue(QOS_CLASS_UTILITY,0);
  for(unsigned thread=0;thread<8;thread++)dispatch_group_async(group,queue,^{for(unsigned i=0;i<2048;i++)Emit(1+thread*2048+i);});
  dispatch_group_async(group,queue,^{OKTraceFlush();});
  Require(dispatch_group_wait(group,dispatch_time(DISPATCH_TIME_NOW,5*NSEC_PER_SEC))==0,@"parallel producers and snapshot complete without waits on a writer");
  Require(atomic_load(&OKTraceEventCount)==256,@"parallel reservation saturates at 256 unique slots");
  Require(atomic_load(&OKTraceDropped)==8*2048+1-256,@"every non-reserved event counted exactly before saturation");
  unsigned valid=0;for(unsigned i=0;i<256;i++){
    Require(atomic_load_explicit(&OKTracePublished[i],memory_order_acquire),@"all completed producer slots published");
    const OKTraceRecord *r=&OKTraceRecords[i];if(i==0)continue;
    if(r->request!=r->handler*2||r->bytes!=r->handler*3||r->generation!=r->handler*4||r->status!=200||r->asset!=2)abort();valid++;
  }
  Require(valid==255&&OKTraceRecords[255].stage==RNCOneKeyTraceEventBudget,@"record fields never tear and terminal budget marker retained");
  Require(SnapshotPublished+SnapshotUnpublished==SnapshotReserved&&Rows.count==SnapshotPublished,@"concurrent snapshot has exact published/unpublished accounting");
  NSUInteger prior=0;for(NSDictionary *row in Rows){NSUInteger next=[row[@"sequence"] unsignedIntegerValue];Require(next>=prior&&next<SnapshotReserved,@"dump indices belong only to reserved prefix");prior=next+1;}
}
static void RealTimer(void){
  UseRealClock=YES;UseRealTimer=YES;uint64_t start=clock_gettime_nsec_np(CLOCK_UPTIME_RAW);
  RNCOneKeyWebEmbedAssets *handler=Start();Require(handler!=nil,@"real timer starts with eligible handler");
  Emit(7);uint64_t eventTimestamp=OKTraceRecords[1].timestampNs;
  while(!atomic_load_explicit(&SummaryDone,memory_order_acquire)){
    uint64_t elapsed=clock_gettime_nsec_np(CLOCK_UPTIME_RAW)-start;
    if(elapsed<64ULL*NSEC_PER_SEC&&atomic_load(&LogCount)!=0)abort();
    if(elapsed>74ULL*NSEC_PER_SEC)break;
    [NSThread sleepForTimeInterval:0.01];
  }
  Require(atomic_load_explicit(&SummaryDone,memory_order_acquire),@"real utility timer completed within existing 75-second observation");
  Require(SnapshotElapsed>=65000&&FlushElapsed<75000&&atomic_load(&TimerCount)==1,@"65-second single timer preserves observation margin");
  Require(Rows.count>=2&&[Rows[1][@"timestampNs"] unsignedLongLongValue]==eventTimestamp&&[Rows[1][@"elapsed"] unsignedLongLongValue]<1000,@"dump retains original event time instead of flush time");
  unsigned before=atomic_load(&LogCount);Flush();Require(atomic_load(&LogCount)==before,@"real timer flush remains one-shot");
}
int main(int argc,const char **argv){@autoreleasepool{
  Checks=[NSMutableArray new];Rows=[NSMutableArray new];atomic_store(&FakeNow,100ULL*NSEC_PER_SEC);
  @try{
    if(argc!=3)abort();NSString *mode=@(argv[2]);
    if([mode isEqual:@"clock"])BudgetClock();else if([mode isEqual:@"partial"])Partial();else if([mode isEqual:@"late-publication"]){HookMode=1;Interval();}else if([mode isEqual:@"late-reservation"]){HookMode=2;Interval();}else if([mode isEqual:@"concurrency"])Concurrency();else if([mode isEqual:@"real-timer"])RealTimer();else abort();
    NSDictionary *report=@{@"passed":@YES,@"mode":mode,@"checks":Checks,@"checkCount":@(Checks.count),@"summary":@{@"reserved":@(SnapshotReserved),@"published":@(SnapshotPublished),@"unpublished":@(SnapshotUnpublished),@"dropped":@(SnapshotDropped),@"requestDropped":@(SnapshotRequestDropped),@"snapshotStartElapsed":@(SnapshotElapsed),@"snapshotEndElapsed":@(SnapshotEndElapsed),@"flushElapsed":@(FlushElapsed),@"flushTimestampNs":[NSString stringWithFormat:@"%llu",FlushTimestampNs]},@"scope":@"Actual C recorder and helper. Harness-only sink and clock/scheduler controls except real-timer. No device, OneKey app, WK or SDK execution."};
    [[NSJSONSerialization dataWithJSONObject:report options:NSJSONWritingPrettyPrinted error:nil]writeToFile:@(argv[1])atomically:YES];printf("PASS checks=%lu\n",(unsigned long)Checks.count);return 0;
  }@catch(NSException *e){fprintf(stderr,"FAIL: fixed native test assertion\n");return 1;}
}}
