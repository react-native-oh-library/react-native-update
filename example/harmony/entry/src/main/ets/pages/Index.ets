/*
 * Copyright (c) 2026 Huawei Device Co., Ltd. All rights reserved
 * Use of this source code is governed by a MIT license that can be
 * found in the LICENSE file.
 */

import {
  AnyJSBundleProvider,
  ComponentBuilderContext,
  FileJSBundleProvider,
  JSBundleProvider,
  MetroJSBundleProvider,
  ResourceJSBundleProvider,
  RNApp,
  RNOHErrorDialog,
  RNOHLogger,
  TraceJSBundleProviderDecorator,
  RNOHCoreContext
} from '@rnoh/react-native-openharmony';
import { PushyFileJSBundleProvider } from '@react-native-ohos/react-native-update';
import { createRNPackages } from '../RNPackagesFactory';

const arkTsComponentNames: Array<string> = [

];
@Builder
export function buildCustomRNComponent(ctx: ComponentBuilderContext) {
  Stack(){
  }
  .position({x:0, y: 0})
}

const wrappedCustomRNComponentBuilder = wrapBuilder(buildCustomRNComponent)

@Entry
@Component
struct Index {
  @StorageLink('RNOHCoreContext') private rnohCoreContext: RNOHCoreContext | undefined = undefined
  @State shouldShow: boolean = false
  private logger!: RNOHLogger

  aboutToAppear() {
    this.logger = this.rnohCoreContext!.logger.clone("Index")
    const stopTracing = this.logger.clone("aboutToAppear").startTracing()

    this.shouldShow = true
    stopTracing()
  }

  onBackPress(): boolean | undefined {
    this.rnohCoreContext!.dispatchBackPress()
    return true
  }

  private createJSBundleProvider(): JSBundleProvider {
    const ctx = this.rnohCoreContext!;
    const providers: JSBundleProvider[] = [];
    if (ctx.isDebugModeEnabled) {
      providers.push(new MetroJSBundleProvider());
    }
    providers.push(new PushyFileJSBundleProvider(ctx.uiAbilityContext));
    if (ctx.isDebugModeEnabled) {
      providers.push(new FileJSBundleProvider('/data/storage/el2/base/files/bundle.harmony.js'));
      providers.push(new ResourceJSBundleProvider(ctx.uiAbilityContext.resourceManager, 'hermes_bundle.hbc'));
    }
    providers.push(new ResourceJSBundleProvider(ctx.uiAbilityContext.resourceManager, 'bundle.harmony.js'));
    return new TraceJSBundleProviderDecorator(new AnyJSBundleProvider(providers), ctx.logger);
  }

  build() {
    Column() {
      if (this.rnohCoreContext && this.shouldShow) {
        if (this.rnohCoreContext?.isDebugModeEnabled) {
          RNOHErrorDialog({ ctx: this.rnohCoreContext })
        }
        RNApp({
          rnInstanceConfig: {
            createRNPackages,
            enableNDKTextMeasuring: true,
            enableBackgroundExecutor: false,
            enableCAPIArchitecture: true,
            arkTsComponentNames: arkTsComponentNames,
          },
          initialProps: { "foo": "bar" } as Record<string, string>,
          appKey: "app_name",
          wrappedCustomRNComponentBuilder: wrappedCustomRNComponentBuilder,
          onSetUp: (rnInstance) => {
            rnInstance.enableFeatureFlag("ENABLE_RN_INSTANCE_CLEAN_UP")
          },
          jsBundleProvider: this.createJSBundleProvider(),
        })
      }
    }
    .height('100%')
    .width('100%')
  }
}
