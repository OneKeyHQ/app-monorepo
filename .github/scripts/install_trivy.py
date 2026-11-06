"""Install the pinned scanner from a checksum-pinned official GitHub Release."""

import argparse
import hashlib
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tarfile
import tempfile

VERSION = '0.71.0'
# Cross-checked against the official release checksums and GitHub asset digests.
ASSETS = {
    ('Linux', 'x86_64'): ('Linux-64bit', '30a3d22b23f88c233f1658f562fb477cae3b3e8b4761109d515b7698daf85814'),
    ('Darwin', 'arm64'): ('macOS-ARM64', '95d4e896b120816edd0995a2df8adca26a8621b7bf62036a89b1d54a7b718a74'),
}


def download(url, destination):
    subprocess.run([
        'curl', '--fail', '--location', '--silent', '--show-error',
        '--proto', '=https', '--proto-redir', '=https',
        '--retry', '3', '--retry-all-errors', '--connect-timeout', '20',
        '--max-time', '180', '--output', str(destination), url,
    ], check=True)


def install(bin_dir):
    asset = ASSETS.get((platform.system(), platform.machine()))
    if asset is None:
        raise RuntimeError('Unsupported Trivy installer platform')
    suffix, expected_digest = asset
    filename = f'trivy_{VERSION}_{suffix}.tar.gz'
    url = f'https://github.com/aquasecurity/trivy/releases/download/v{VERSION}/{filename}'
    bin_dir = Path(bin_dir).resolve()
    bin_dir.mkdir(parents=True, exist_ok=True)
    # Stage next to the destination so only a verified executable replaces it.
    with tempfile.TemporaryDirectory(prefix='.trivy-install-', dir=bin_dir) as tmp:
        archive_path = Path(tmp) / filename
        download(url, archive_path)
        digest = hashlib.sha256()
        with archive_path.open('rb') as archive:
            for chunk in iter(lambda: archive.read(1024 * 1024), b''):
                digest.update(chunk)
        if digest.hexdigest() != expected_digest:
            raise RuntimeError('Trivy archive SHA-256 mismatch')
        binary = Path(tmp) / 'trivy'
        with tarfile.open(archive_path, 'r:gz') as archive:
            members = [member for member in archive.getmembers() if member.name == 'trivy']
            if len(members) != 1 or not members[0].isfile():
                raise RuntimeError('Trivy archive must contain one regular trivy executable')
            # Extract only the binary; never follow archive paths or links.
            with archive.extractfile(members[0]) as source, binary.open('wb') as target:
                shutil.copyfileobj(source, target)
        binary.chmod(0o755)
        version = subprocess.run([str(binary), '--version'], check=True,
                                 capture_output=True, text=True).stdout.splitlines()
        if not version or version[0] != 'Version: ' + VERSION:
            raise RuntimeError('Installed Trivy version does not match the pinned version')
        binary.replace(bin_dir / 'trivy')
    if os.environ.get('GITHUB_PATH'):
        with Path(os.environ['GITHUB_PATH']).open('a') as github_path:
            github_path.write(str(bin_dir) + '\n')
    print(f'Installed Trivy {VERSION} from the official GitHub Release with SHA-256 verification')
    return bin_dir / 'trivy'


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bin-dir', type=Path, required=True)
    install(parser.parse_args().bin_dir)
