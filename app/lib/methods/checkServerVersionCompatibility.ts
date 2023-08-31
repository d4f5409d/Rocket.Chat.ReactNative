import { satisfies } from 'semver';
import moment from 'moment';

import { ISupportedVersions, LTSDictionary, LTSMessage, LTSVersion } from '../../definitions';
import builtInSupportedVersions from '../../../app-supportedversions.json';

interface IServerVersionCompatibilityResult {
	success: boolean;
	message?: LTSMessage;
	i18n?: LTSDictionary;
}

export const getMessage = ({
	messages,
	expiration
}: {
	messages?: LTSMessage[];
	expiration?: string;
}): LTSMessage | undefined => {
	if (!messages?.length || !expiration || moment(expiration).diff(new Date(), 'days') < 0) {
		return;
	}
	const sortedMessages = messages.sort((a, b) => a.remainingDays - b.remainingDays);
	return sortedMessages.find(({ remainingDays }) => moment(expiration).diff(new Date(), 'days') <= remainingDays);
};

export const checkServerVersionCompatibility = function ({
	supportedVersions,
	serverVersion
}: {
	supportedVersions?: ISupportedVersions;
	serverVersion: string;
}): IServerVersionCompatibilityResult {
	// 1.2.3 -> ~1.2
	const serverVersionTilde = `~${serverVersion.split('.').slice(0, 2).join('.')}`;

	// Built-in suported versions
	if (!supportedVersions || supportedVersions.timestamp < builtInSupportedVersions.timestamp) {
		const versionInfo = builtInSupportedVersions.versions.find(({ version }) =>
			satisfies(version, serverVersionTilde)
		) as LTSVersion;
		const messages = versionInfo?.messages || (builtInSupportedVersions?.messages as LTSMessage[]);
		const message = getMessage({ messages, expiration: versionInfo?.expiration });
		return {
			success: !!(versionInfo && new Date(versionInfo.expiration) >= new Date()),
			message,
			i18n: message ? builtInSupportedVersions?.i18n : undefined
		};
	}

	// Backend/Cloud
	const versionInfo = supportedVersions.versions.find(({ version }) => satisfies(version, serverVersionTilde));
	if (versionInfo && new Date(versionInfo.expiration) >= new Date()) {
		const messages = versionInfo?.messages || supportedVersions?.messages;
		const message = getMessage({ messages, expiration: versionInfo.expiration });
		return {
			success: true,
			message,
			i18n: message ? supportedVersions?.i18n : undefined
		};
	}

	// Exceptions
	const exception = supportedVersions.exceptions?.versions.find(({ version }) => satisfies(version, serverVersionTilde));
	const messages =
		exception?.messages || supportedVersions.exceptions?.messages || versionInfo?.messages || supportedVersions.messages;
	const message = getMessage({ messages, expiration: exception?.expiration });
	return {
		success: !!(exception && new Date(exception.expiration) >= new Date()),
		message,
		i18n: message ? supportedVersions?.i18n : undefined
	};
};
