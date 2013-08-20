#!/bin/bash -e
# Copyright (c) 2013 The Chromium OS Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

case $1 in
-h|--help)
  echo "Usage: $0 [rev]"
  exit 0
  ;;
esac

json_value() {
  local key=$1
  sed -n -r \
    -e '/^[[:space:]]*"'"${key}"'"/s|.*:[[:space:]]*"([^"]*)",?$|\1|p' \
    manifest.json
}

PN=$(json_value name | sed 's:[[:space:]]:_:g' | tr '[:upper:]' '[:lower:]')
PV=$(json_value version)
rev=${1:-0}
PVR="${PV}.${rev}"
P="${PN}-${PVR}"

rm -rf "${P}"
mkdir "${P}"

while read line ; do
  [[ ${line} == */* ]] && mkdir -p "${P}/${line%/*}"
  ln "${line}" "${P}/${line}"
done < <(sed 's:#.*::' manifest.files)
cp manifest.json "${P}/"

sed -i \
  -e '/"version"/s:"[^"]*",:"'${PVR}'",:' \
  "${P}/manifest.json"

zip="${P}.zip"
zip -r "${zip}" "${P}"
rm -rf "${P}"
du -b "${zip}"
