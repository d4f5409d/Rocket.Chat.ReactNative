import moment from 'moment';
import coerce from 'semver/functions/coerce';
import satisfies from 'semver/functions/satisfies';

import { ISupportedVersionsData, TSVDictionary, TSVMessage, TSVStatus } from '../../definitions';
import builtInSupportedVersions from '../../../app-supportedversions.json';

export const getMessage = ({
	messages,
	expiration
}: {
	messages?: TSVMessage[];
	expiration?: string;
}): TSVMessage | undefined => {
	if (!messages?.length || !expiration || moment(expiration).diff(new Date(), 'days') < 0) {
		return;
	}
	const sortedMessages = messages.sort((a, b) => a.remainingDays - b.remainingDays);
	return sortedMessages.find(({ remainingDays }) => moment(expiration).diff(new Date(), 'days') <= remainingDays);
};

const getStatus = ({ expiration, message }: { expiration?: string; message?: TSVMessage }): TSVStatus => {
	if (!(expiration && new Date(expiration) >= new Date())) {
		return 'expired';
	}
	if (message) {
		return 'warn';
	}
	return 'supported';
};

export const checkSupportedVersions = function ({
	supportedVersions,
	serverVersion
}: {
	supportedVersions?: ISupportedVersionsData;
	serverVersion: string;
}): {
	status: TSVStatus;
	message?: TSVMessage;
	i18n?: TSVDictionary;
	expiration?: string;
} {
	const serverVersionTilde = `~${serverVersion.split('.').slice(0, 2).join('.')}`;
	let sv: ISupportedVersionsData;
	if (!supportedVersions || supportedVersions.timestamp < builtInSupportedVersions.timestamp) {
		// Built-in supported versions
		sv = builtInSupportedVersions as ISupportedVersionsData;
	} else {
		// Backend/Cloud
		sv = supportedVersions;
	}

	const versionInfo = sv.versions.find(({ version }) => satisfies(coerce(version)?.version ?? '', serverVersionTilde));
	if (versionInfo && new Date(versionInfo.expiration) >= new Date()) {
		const messages = versionInfo?.messages || sv?.messages;
		const message = getMessage({ messages, expiration: versionInfo.expiration });
		return {
			status: getStatus({ expiration: versionInfo?.expiration, message }),
			message,
			i18n: message ? sv?.i18n : undefined,
			expiration: versionInfo?.expiration
		};
	}

	// Exceptions
	const exception = sv.exceptions?.versions?.find(({ version }) => satisfies(coerce(version)?.version ?? '', serverVersionTilde));
	const messages = exception?.messages || sv.exceptions?.messages || versionInfo?.messages || sv.messages;
	const message = getMessage({ messages, expiration: exception?.expiration });
	const status = getStatus({ expiration: exception?.expiration, message });

	// TODO: enforcement start date is temp only. Remove after a few releases.
	if (status === 'expired' && sv?.enforcementStartDate && new Date(sv.enforcementStartDate) > new Date()) {
		const enforcementMessage = getMessage({
			messages,
			expiration: sv.enforcementStartDate
		});
		return {
			status: 'warn',
			message: enforcementMessage,
			i18n: enforcementMessage ? sv?.i18n : undefined,
			expiration: sv.enforcementStartDate
		};
	}

	return {
		status,
		message,
		i18n: message ? sv?.i18n : undefined,
		expiration: exception?.expiration
	};
};
