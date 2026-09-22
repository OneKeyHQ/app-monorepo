"""Isolate cache fixtures without changing the production snapshot implementation."""
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('dependencies', Path(__file__).with_name('ci-dependencies.py'))
dependencies = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dependencies)
snapshot = dependencies.Snapshot()
if sys.argv[1] == 'prepare':
    batch, lane = os.environ['BENCHMARK_BATCH'], os.environ['BENCHMARK_LANE']
    if not re.fullmatch(r'[a-z0-9-]{1,50}', batch) or lane not in {'direct', 'gated'}:
        raise ValueError('Invalid benchmark cache namespace')
    snapshot.prepare()
    original = snapshot.state['key']
    snapshot.state['key'] = f'ci-gate-bench-v1-{batch}-{lane}-{original}'
    snapshot.save_state()
    dependencies.output('key', snapshot.state['key'])
    dependencies.output('yarn-key', f'ci-gate-bench-v1-{batch}-yarn-{original}')
    dependencies.output('yarn-path', subprocess.check_output(['yarn', 'config', 'get', 'cacheFolder'], text=True).strip())
    print('Benchmark fixture: ' + json.dumps({'batch': batch, 'lane': lane, 'key': snapshot.state['key']}))
else:
    getattr(snapshot, sys.argv[1])()
