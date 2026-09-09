#import <Foundation/Foundation.h>
#import <WebKit/WebKit.h>
#import <stdatomic.h>
#import <time.h>
#import "TraceConfig.h"
static atomic_bool TimerReturned;
static atomic_uint TimerCalls;
static uint64_t TimerReturnNs;
static void HarnessAfter(dispatch_time_t when,dispatch_queue_t queue,dispatch_block_t block){
  atomic_fetch_add(&TimerCalls,1);
  dispatch_after(when,queue,^{block();TimerReturnNs=clock_gettime_nsec_np(CLOCK_UPTIME_RAW);atomic_store_explicit(&TimerReturned,true,memory_order_release);});
}
#define dispatch_after HarnessAfter
#import "source/RNCOneKeyWebEmbedAssets.m"
#undef dispatch_after
int main(int argc,const char **argv){@autoreleasepool{
  if(argc!=2)return 2;
  RNCOneKeyWebEmbedAssets *handler=[[RNCOneKeyWebEmbedAssets alloc]initWithBundle:NSBundle.mainBundle];
  if(!handler||atomic_load(&TimerCalls)!=1)return 3;
  for(unsigned i=0;i<300;i++)[handler traceLifecycle:RNCOneKeyTraceNavigationFinish generation:i committed:YES];
  uint64_t lastEvent=OKTraceRecords[255].timestampNs;
  while(!atomic_load_explicit(&TimerReturned,memory_order_acquire)){
    uint64_t elapsed=clock_gettime_nsec_np(CLOCK_UPTIME_RAW)-OKTraceStartedNs;
    if(elapsed<64ULL*NSEC_PER_SEC&&atomic_load(&OKTraceFlushed))return 4;
    if(elapsed>74ULL*NSEC_PER_SEC)return 5;
    [NSThread sleepForTimeInterval:0.01];
  }
  uint64_t elapsedMs=(TimerReturnNs-OKTraceStartedNs)/NSEC_PER_MSEC;
  if(elapsedMs<65000||elapsedMs>=75000||lastEvent!=OKTraceRecords[255].timestampNs||atomic_load(&OKTraceEventCount)!=256||!atomic_load(&OKTraceFlushed))return 6;
  NSDictionary *report=@{@"passed":@YES,@"timerCalls":@(atomic_load(&TimerCalls)),@"actualUtilityFlushCompletedMs":@(elapsedMs),@"records":@256,@"dropped":@(atomic_load(&OKTraceDropped)),@"scope":@"Actual production recorder, os_log formatting/submission and 65-second utility scheduling in a macOS CLI-only native bundle. No simulated clock or log sink, no device/OneKey/WK/SDK. Log-persistence delivery is not asserted."};
  [[NSJSONSerialization dataWithJSONObject:report options:NSJSONWritingPrettyPrinted error:nil]writeToFile:@(argv[1])atomically:YES];printf("PASS actual-log-timer ms=%llu\n",(unsigned long long)elapsedMs);return 0;
}}
