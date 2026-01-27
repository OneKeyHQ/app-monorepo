/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *-------------------------------------------------------------------------------------------- */

import { Disposable } from 'base/common/lifecycle'

export class TimeoutTimer extends Disposable {
	private _token: any

	constructor();
	constructor(runner: () => void, timeout: number);
	constructor(runner?: () => void, timeout?: number) {
		super()
		this._token = -1

		if (typeof runner === 'function' && typeof timeout === 'number') {
			this.setIfNotSet(runner, timeout)
		}
	}

	dispose(): void {
		this.cancel()
		super.dispose()
	}

	cancel(): void {
		if (this._token !== -1) {
			clearTimeout(this._token)
			this._token = -1
		}
	}

	cancelAndSet(runner: () => void, timeout: number): void {
		this.cancel()
		this._token = setTimeout(() => {
			this._token = -1
			runner()
		}, timeout)
	}

	setIfNotSet(runner: () => void, timeout: number): void {
		if (this._token !== -1) {
			// timer is already set
			return
		}
		this._token = setTimeout(() => {
			this._token = -1
			runner()
		}, timeout)
	}
}

export class RunOnceScheduler {
	protected runner: ((...args: any[]) => void) | null

	private timeoutToken: any
	private timeout: number
	private timeoutHandler: () => void

	constructor(runner: (...args: any[]) => void, timeout: number) {
		this.timeoutToken = -1
		this.runner = runner
		this.timeout = timeout
		this.timeoutHandler = this.onTimeout.bind(this)
	}

	/**
	 * Dispose RunOnceScheduler
	 */
	dispose(): void {
		this.cancel()
		this.runner = null
	}

	/**
	 * Cancel current scheduled runner (if any).
	 */
	cancel(): void {
		if (this.isScheduled()) {
			clearTimeout(this.timeoutToken)
			this.timeoutToken = -1
		}
	}

	/**
	 * Cancel previous runner (if any) & schedule a new runner.
	 */
	schedule(delay = this.timeout): void {
		this.cancel()
		this.timeoutToken = setTimeout(this.timeoutHandler, delay)
	}

	/**
	 * Returns true if scheduled.
	 */
	isScheduled(): boolean {
		return this.timeoutToken !== -1
	}

	private onTimeout() {
		this.timeoutToken = -1
		if (this.runner) {
			this.doRun()
		}
	}

	protected doRun(): void {
		if (this.runner) {
			this.runner()
		}
	}
}