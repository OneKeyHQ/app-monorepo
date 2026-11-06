"""Installer failure and archive-isolation regressions; no network is used."""

import hashlib
import importlib.util
import io
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('installer', Path(__file__).with_name('install_trivy.py'))
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.bin_dir = self.root / 'bin'
        self.bin_dir.mkdir()
        self.binary = self.bin_dir / 'trivy'
        self.binary.write_text('previous scanner')
        self.github_path = self.root / 'github-path'
        self.github_path.write_text('previous path\n')
        for name, value in (('system', 'Linux'), ('machine', 'x86_64')):
            mock = patch.object(installer.platform, name, return_value=value)
            mock.start()
            self.addCleanup(mock.stop)
        env = patch.dict(os.environ, {'GITHUB_PATH': str(self.github_path)})
        env.start()
        self.addCleanup(env.stop)

    def archive(self, version=None, kind='file', duplicate=False, traversal=False):
        contents = ('#!/bin/sh\nprintf "Version: ' + (version or installer.VERSION) + '\\n"\n').encode()
        output = io.BytesIO()
        with tarfile.open(fileobj=output, mode='w:gz') as archive:
            member = tarfile.TarInfo('trivy')
            member.size = len(contents)
            if kind == 'symlink':
                member.type = tarfile.SYMTYPE
                member.linkname = '../outside'
                member.size = 0
            archive.addfile(member, io.BytesIO(contents) if kind == 'file' else None)
            if duplicate:
                archive.addfile(member, io.BytesIO(contents))
            if traversal:
                extra = tarfile.TarInfo('../../outside')
                extra.size = 7
                archive.addfile(extra, io.BytesIO(b'ignored'))
        return output.getvalue()

    def run_install(self, body, digest=None):
        checksum = digest or hashlib.sha256(body).hexdigest()
        assets = {('Linux', 'x86_64'): ('Linux-64bit', checksum)}
        with patch.object(installer, 'ASSETS', assets), patch.object(
            installer, 'download', side_effect=lambda _url, destination: destination.write_bytes(body),
        ) as download:
            result = installer.install(self.bin_dir)
        return result, download

    def unchanged(self):
        self.assertEqual(self.binary.read_text(), 'previous scanner')
        self.assertEqual(self.github_path.read_text(), 'previous path\n')
        self.assertEqual(list(self.bin_dir.iterdir()), [self.binary])

    def test_installs_verified_release_and_publishes_path(self):
        result, download = self.run_install(self.archive())
        self.assertEqual(result, self.binary.resolve())
        self.assertEqual(subprocess.check_output([str(result), '--version'], text=True).strip(),
                         'Version: ' + installer.VERSION)
        self.assertEqual(self.github_path.read_text(), 'previous path\n' + str(self.bin_dir) + '\n')
        self.assertEqual(download.call_args.args[0],
                         f'https://github.com/aquasecurity/trivy/releases/download/v{installer.VERSION}/'
                         f'trivy_{installer.VERSION}_Linux-64bit.tar.gz')

    def test_checksum_mismatch_does_not_execute_or_replace_binary(self):
        with patch.object(installer.subprocess, 'run') as run:
            with self.assertRaisesRegex(RuntimeError, 'SHA-256 mismatch'):
                self.run_install(self.archive(), '0' * 64)
            run.assert_not_called()
        self.unchanged()

    def test_wrong_version_preserves_previous_installation(self):
        with self.assertRaisesRegex(RuntimeError, 'pinned version'):
            self.run_install(self.archive(version='0.76.1'))
        self.unchanged()

    def test_download_failure_preserves_previous_installation(self):
        with patch.object(installer, 'download', side_effect=subprocess.CalledProcessError(6, 'curl')):
            with self.assertRaises(subprocess.CalledProcessError):
                installer.install(self.bin_dir)
        self.unchanged()

    def test_links_and_duplicate_binaries_fail_closed(self):
        for options in ({'kind': 'symlink'}, {'duplicate': True}):
            with self.subTest(options=options):
                with self.assertRaisesRegex(RuntimeError, 'one regular trivy executable'):
                    self.run_install(self.archive(**options))
                self.unchanged()

    def test_does_not_extract_other_archive_members(self):
        self.run_install(self.archive(traversal=True))
        self.assertFalse((self.root / 'outside').exists())

    def test_unknown_platform_never_downloads(self):
        with patch.object(installer.platform, 'machine', return_value='unknown'), \
                patch.object(installer, 'download') as download:
            with self.assertRaisesRegex(RuntimeError, 'Unsupported'):
                installer.install(self.bin_dir)
            download.assert_not_called()
        self.unchanged()

    def test_download_enforces_https_and_reports_http_failures(self):
        with patch.object(installer.subprocess, 'run') as run:
            installer.download('https://github.com/fixture', self.root / 'archive')
        command = run.call_args.args[0]
        self.assertIn('--fail', command)
        for flag in ('--proto', '--proto-redir'):
            self.assertEqual(command[command.index(flag) + 1], '=https')
        self.assertTrue(run.call_args.kwargs['check'])


if __name__ == '__main__':
    unittest.main()
