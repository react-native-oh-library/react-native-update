// Copyright (c) 2025 Huawei Device Co., Ltd. All rights reserved
// Use of this source code is governed by a MIT license that can be
// found in the LICENSE file.

#include "RNOH/PackageProvider.h"
#include "generated/RNOHGeneratedPackage.h"
#include "RNOHPackagesFactory.h"

using namespace rnoh;

std::vector<std::shared_ptr<Package>> PackageProvider::getPackages(Package::Context ctx) {
    const std::vector<std::shared_ptr<Package>> ManualLinkingPackage = {
        std::make_shared<RNOHGeneratedPackage>(ctx),
    };

    auto packages = createRNOHPackages(ctx);
    for (const auto &pkg : ManualLinkingPackage) {
        packages.push_back(pkg);
    }
    return packages;
}
