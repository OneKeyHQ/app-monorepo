//
//  PerfMemoryModule.m
//  OneKeyWallet
//

#import "PerfMemoryModule.h"

#import <mach/mach.h>
#import <mach/task_info.h>

@implementation PerfMemoryModule

RCT_EXPORT_MODULE(PerfMemoryModule);

RCT_EXPORT_METHOD(getMemoryUsage:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    // Prefer phys_footprint when available (closest to "real" memory impact).
    task_vm_info_data_t vmInfo;
    mach_msg_type_number_t count = TASK_VM_INFO_COUNT;
    kern_return_t kr = task_info(mach_task_self(), TASK_VM_INFO, (task_info_t)&vmInfo, &count);

    if (kr == KERN_SUCCESS) {
      uint64_t footprint = vmInfo.phys_footprint;
      resolve(@{ @"rss": @(footprint) });
      return;
    }

    // Fallback: resident size.
    mach_task_basic_info_data_t info;
    mach_msg_type_number_t size = MACH_TASK_BASIC_INFO_COUNT;
    kr = task_info(mach_task_self(), MACH_TASK_BASIC_INFO, (task_info_t)&info, &size);
    if (kr == KERN_SUCCESS) {
      resolve(@{ @"rss": @(info.resident_size) });
      return;
    }

    resolve([NSNull null]);
  } @catch (NSException *exception) {
    reject(@"PERF_MEMORY_ERROR", exception.reason, nil);
  }
}

@end
