import 'jest';
import { v4 as uuidv4 } from 'uuid';

import type BormClient from '../../../src/index';
import { cleanup, init } from '../../helpers/lifecycle';
import { deepRemoveMetaData, deepSort, expectArraysInObjectToContainSameElements } from '../../helpers/matchers';
import type { typesSchema } from '../../mocks/generatedSchema';
import type { TypeGen } from '../../../src/types/typeGen';
import type { WithBormMetadata } from '../../../src/index';
import type { UserType } from '../../types/testTypes';

describe('Query', () => {
	let dbName: string;
	let client: BormClient;

	beforeAll(async () => {
		const { dbName: configDbName, bormClient: configClient } = await init();
		if (!configClient) {
			throw new Error('Failed to initialize BormClient');
		}
		dbName = configDbName;
		client = configClient;
	}, 15000);

	it('v1[validation] - $entity missing', async () => {
		expect(client).toBeDefined();
		// @ts-expect-error - $entity is missing
		await expect(client.query({})).rejects.toThrow();
	});

	it('v2[validation] - $entity not in schema', async () => {
		expect(client).toBeDefined();
		await expect(client.query({ $entity: 'fakeEntity' })).rejects.toThrow();
	});

	it('v3[validation] - $id not existing', async () => {
		expect(client).toBeDefined();
		const res = await client.query({ $entity: 'User', $id: 'nonExisting' });
		await expect(res).toBeNull();
	});

	it('e1[entity] - basic and direct link to relation', async () => {
		expect(client).toBeDefined();
		const query = { $entity: 'User' };
		const expectedRes = [
			{
				'$entity': 'User',
				'$id': 'user1',
				'name': 'Antoine',
				'email': 'antoine@test.com',
				'id': 'user1',
				'accounts': ['account1-1', 'account1-2', 'account1-3'],
				'spaces': ['space-1', 'space-2'],
				'user-tags': ['tag-1', 'tag-2'],
			},
			{
				'$entity': 'User',
				'$id': 'user2',
				'name': 'Loic',
				'email': 'loic@test.com',
				'id': 'user2',
				'accounts': ['account2-1'],
				'spaces': ['space-2'],
				'user-tags': ['tag-3', 'tag-4'],
			},
			{
				'$entity': 'User',
				'$id': 'user3',
				'name': 'Ann',
				'email': 'ann@test.com',
				'id': 'user3',
				'accounts': ['account3-1'],
				'spaces': ['space-2'],
				'user-tags': ['tag-2'],
			},
			{
				$entity: 'User',
				$id: 'user4',
				id: 'user4',
				name: 'Ben',
			},
			{
				$entity: 'User',
				$id: 'user5',
				email: 'charlize@test.com',
				id: 'user5',
				name: 'Charlize',
				spaces: ['space-1'],
			},
		];
		const res = await client.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, 'id')).toEqual(expectedRes);
	}, 3600000);

	it('e2[entity] - filter by single $id', async () => {
		expect(client).toBeDefined();
		const query = { $entity: 'User', $id: 'user1' };
		const expectedRes = {
			'$entity': 'User',
			'$id': 'user1',
			'name': 'Antoine',
			'email': 'antoine@test.com',
			'id': 'user1',
			'accounts': ['account1-1', 'account1-2', 'account1-3'],
			'spaces': ['space-1', 'space-2'],
			'user-tags': ['tag-1', 'tag-2'],
		};

		const res = (await client.query(query)) as UserType;

		expect(res).toBeDefined();

		// @ts-expect-error - Not an array but should work anyway
		expectArraysInObjectToContainSameElements(res, expectedRes);

		expect(res['user-tags']).toEqual(expect.arrayContaining(expectedRes['user-tags']));

		expect(res['user-tags']).toHaveLength(expectedRes['user-tags'].length);
	}, 3600000);

	it('e3[entity, nested] - direct link to relation, query nested ', async () => {
		expect(client).toBeDefined();
		const query = { $entity: 'User', $fields: ['id', { $path: 'user-tags' }] };
		const expectedRes = [
			{
				'$entity': 'User',
				'$id': 'user1',
				'id': 'user1',
				'user-tags': [
					{
						$relation: 'UserTag',
						$id: 'tag-1',
						id: 'tag-1',
						users: ['user1'],
						color: 'yellow',
						group: 'utg-1',
					},
					{
						$relation: 'UserTag',
						$id: 'tag-2',
						id: 'tag-2',
						users: ['user1', 'user3'],
						color: 'yellow',
						group: 'utg-1',
					},
				],
			},
			{
				'$entity': 'User',
				'$id': 'user2',
				'id': 'user2',
				'user-tags': [
					{
						$relation: 'UserTag',
						$id: 'tag-3',
						id: 'tag-3',
						users: ['user2'],
						color: 'blue',
						group: 'utg-2',
					},
					{
						$relation: 'UserTag',
						$id: 'tag-4',
						id: 'tag-4',
						users: ['user2'],
					},
				],
			},
			{
				'$entity': 'User',
				'$id': 'user3',
				'id': 'user3',
				'user-tags': [
					{
						$relation: 'UserTag',
						$id: 'tag-2',
						id: 'tag-2',
						users: ['user1', 'user3'],
						color: 'yellow',
						group: 'utg-1',
					},
				],
			},
			{
				$entity: 'User',
				$id: 'user4',
				id: 'user4',
			},
			{
				$entity: 'User',
				$id: 'user5',
				id: 'user5',
			},
		];
		const res = await client.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await client.query(query, {
			noMetadata: true,
		});
		expect(deepSort(resWithoutMetadata, 'id')).toEqual(deepRemoveMetaData(expectedRes));
	});

	it('opt1[options, noMetadata', async () => {
		expect(client).toBeDefined();
		const query = { $entity: 'User', $id: 'user1' };
		const expectedRes = {
			'name': 'Antoine',
			'email': 'antoine@test.com',
			'id': 'user1',
			'accounts': ['account1-1', 'account1-2', 'account1-3'],
			'spaces': ['space-1', 'space-2'],
			'user-tags': ['tag-1', 'tag-2'],
		};

		type UserType = WithBormMetadata<TypeGen<typeof typesSchema.entities.User>>;
		const res = (await client.query(query, {
			noMetadata: true,
		})) as UserType;
		expect(res).toBeDefined();
		expect(typeof res).not.toBe('string');

		// @ts-expect-error - res should defined
		expectArraysInObjectToContainSameElements(res, expectedRes);

		expect(res['user-tags']).toHaveLength(expectedRes['user-tags'].length);
	});

	it('opt2[options, debugger', async () => {
		expect(client).toBeDefined();
		const query = { $entity: 'User', $id: 'user1' };
		const expectedRes = {
			'$id': 'user1',
			'$entity': 'User',
			/// if this fails, other stuff fails, for some reason, fix this first
			'$debugger': {
				tqlRequest: {
					entity:
						'match $User  isa User, has attribute $attribute  , has id $User_id; $User_id "user1"; get; group $User;',
					relations: [
						{
							entity: 'User',
							relation: 'User-Accounts',
							request:
								'match $user isa User , has id $user_id; $user_id "user1";  (user: $user,accounts: $accounts ) isa User-Accounts; $accounts isa Account, has id $accounts_id; get; group $user;',
						},
						{
							entity: 'User',
							relation: 'User-Sessions',
							request:
								'match $user isa User , has id $user_id; $user_id "user1";  (user: $user,sessions: $sessions ) isa User-Sessions; $sessions isa Session, has id $sessions_id; get; group $user;',
						},
						{
							entity: 'User',
							relation: 'Space-User',
							request:
								'match $users isa User , has id $users_id; $users_id "user1";  (users: $users,spaces: $spaces ) isa Space-User; $spaces isa Space, has id $spaces_id; get; group $users;',
						},
						{
							entity: 'User',
							relation: 'UserTag',
							request:
								'match $users isa User , has id $users_id; $users_id "user1"; $UserTag (users: $users ) isa UserTag; $UserTag isa UserTag, has id $UserTag_id; get; group $users;',
						},
					],
				},
			},
			'name': 'Antoine',
			'email': 'antoine@test.com',
			'id': 'user1',
			'accounts': ['account1-1', 'account1-2', 'account1-3'],
			'spaces': ['space-1', 'space-2'],
			'user-tags': ['tag-1', 'tag-2'],
		};

		const res = (await client.query(query, {
			debugger: true,
		})) as UserType;
		expect(res).toBeDefined();
		expect(typeof res).not.toBe('string');

		// @ts-expect-error - res should defined
		expectArraysInObjectToContainSameElements(res, expectedRes);

		expect(res['user-tags']).toHaveLength(expectedRes['user-tags'].length);
	});

	it('opt3a[options, returnNulll] - empty fields option in entity', async () => {
		expect(client).toBeDefined();
		const query = { $entity: 'User', $id: 'user4', $fields: ['spaces', 'email', 'user-tags'] };
		const expectedRes = {
			'$entity': 'User',
			'email': null, //Example field
			'$id': 'user4',
			'spaces': null, //example linkfield from intermediary relation
			'user-tags': null, //example linkfield from direct relation
		};
		const res = await client.query(query, { returnNulls: true });
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, 'id')).toEqual(expectedRes);
	});

	it('r1[relation] - basic', async () => {
		expect(client).toBeDefined();
		const query = { $relation: 'User-Accounts' };
		const expectedRes = [
			{
				$relation: 'User-Accounts',
				$id: 'ua1-1',
				id: 'ua1-1',
				user: 'user1',
				accounts: ['account1-1'],
			},
			{
				$relation: 'User-Accounts',
				$id: 'ua1-2',
				id: 'ua1-2',
				user: 'user1',
				accounts: ['account1-2'],
			},
			{
				$relation: 'User-Accounts',
				$id: 'ua1-3',
				id: 'ua1-3',
				user: 'user1',
				accounts: ['account1-3'],
			},
			{
				$relation: 'User-Accounts',
				$id: 'ua2-1',
				id: 'ua2-1',
				user: 'user2',
				accounts: ['account2-1'],
			},
			{
				$relation: 'User-Accounts',
				$id: 'ua3-1',
				id: 'ua3-1',
				user: 'user3',
				accounts: ['account3-1'],
			},
		];
		const res = await client.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await client.query(query, {
			noMetadata: true,
		});

		expect(deepSort(resWithoutMetadata, 'id')).toEqual(
			expectedRes.map(({ $id: _id, $relation: _entity, ...rest }) => rest),
		);
	});

	it('r2[relation] - filtered fields', async () => {
		expect(client).toBeDefined();
		const query = { $relation: 'User-Accounts', $fields: ['user'] };
		const expectedRes = [
			{
				$relation: 'User-Accounts',
				$id: 'ua1-1',
				user: 'user1',
			},
			{
				$relation: 'User-Accounts',
				$id: 'ua1-2',
				user: 'user1',
			},
			{
				$relation: 'User-Accounts',
				$id: 'ua1-3',
				user: 'user1',
			},
			{
				$relation: 'User-Accounts',
				$id: 'ua2-1',
				user: 'user2',
			},
			{
				$relation: 'User-Accounts',
				$id: 'ua3-1',
				user: 'user3',
			},
		];
		const res = await client.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await client.query(query, {
			noMetadata: true,
		});
		expect(deepSort(resWithoutMetadata, 'user')).toEqual(
			expectedRes.map(({ $id: _id, $relation: _entity, ...rest }) => rest),
		);
	});

	it('r3[relation, nested] - nested entity', async () => {
		expect(client).toBeDefined();
		const query = {
			$relation: 'User-Accounts',
			$fields: ['id', { $path: 'user', $fields: ['name'] }],
		};
		const expectedRes = [
			{
				$relation: 'User-Accounts',
				$id: 'ua1-1',
				id: 'ua1-1',
				user: {
					$entity: 'User',
					$id: 'user1',
					name: 'Antoine',
				},
			},
			{
				$relation: 'User-Accounts',
				$id: 'ua1-2',
				id: 'ua1-2',
				user: {
					$entity: 'User',
					$id: 'user1',
					name: 'Antoine',
				},
			},
			{
				$relation: 'User-Accounts',
				$id: 'ua1-3',
				id: 'ua1-3',
				user: {
					$entity: 'User',
					$id: 'user1',
					name: 'Antoine',
				},
			},
			{
				$relation: 'User-Accounts',
				$id: 'ua2-1',
				id: 'ua2-1',
				user: {
					$entity: 'User',
					$id: 'user2',
					name: 'Loic',
				},
			},
			{
				$relation: 'User-Accounts',
				$id: 'ua3-1',
				id: 'ua3-1',
				user: {
					$entity: 'User',
					$id: 'user3',
					name: 'Ann',
				},
			},
		];
		const res = await client.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, '$id')).toEqual(expectedRes);
		const resWithoutMetadata = await client.query(query, {
			noMetadata: true,
		});

		expect(deepSort(resWithoutMetadata, 'id')).toEqual(deepRemoveMetaData(expectedRes));
	});

	it('r4[relation, nested, direct] - nested relation direct on relation', async () => {
		expect(client).toBeDefined();
		const query = {
			$relation: 'UserTag',
			$fields: [
				'id',
				{ $path: 'users', $fields: ['id'] },
				{ $path: 'group', $fields: ['id'] },
				{ $path: 'color', $fields: ['id'] },
			],
		};
		const expectedRes = [
			{
				$id: 'tag-1',
				id: 'tag-1',
				$relation: 'UserTag',
				color: { $id: 'yellow', $entity: 'Color', id: 'yellow' },
				group: { $id: 'utg-1', $relation: 'UserTagGroup', id: 'utg-1' },
				users: [{ $id: 'user1', $entity: 'User', id: 'user1' }],
			},
			{
				$id: 'tag-2',
				id: 'tag-2',
				$relation: 'UserTag',
				color: { $id: 'yellow', $entity: 'Color', id: 'yellow' },
				group: { $id: 'utg-1', $relation: 'UserTagGroup', id: 'utg-1' },
				users: [
					{ $id: 'user1', $entity: 'User', id: 'user1' },
					{ $id: 'user3', $entity: 'User', id: 'user3' },
				],
			},
			{
				$id: 'tag-3',
				id: 'tag-3',
				$relation: 'UserTag',
				color: { $id: 'blue', $entity: 'Color', id: 'blue' },
				group: { $id: 'utg-2', $relation: 'UserTagGroup', id: 'utg-2' },
				users: [{ $id: 'user2', $entity: 'User', id: 'user2' }],
			},
			{
				$id: 'tag-4',
				id: 'tag-4',
				$relation: 'UserTag',
				users: [{ $id: 'user2', $entity: 'User', id: 'user2' }],
			},
		];
		const res = await client.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);
		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await client.query(query, {
			noMetadata: true,
		});
		expect(deepSort(resWithoutMetadata, 'id')).toEqual(deepRemoveMetaData(expectedRes));
	});

	it('r5[relation nested] - that has both role, and linkfield pointing to same role', async () => {
		expect(client).toBeDefined();
		const query = {
			$entity: 'Color',
			$fields: ['id', 'user-tags', 'group'],
		};
		const expectedRes = [
			{
				'$id': 'blue',
				'$entity': 'Color',
				'id': 'blue',
				'group': 'utg-2',
				'user-tags': ['tag-3'],
			}, // group 1's color
			{
				'$id': 'yellow',
				'$entity': 'Color',
				'id': 'yellow',
				'group': 'utg-1',
				'user-tags': ['tag-1', 'tag-2'],
			},
		];
		const res = await client.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await client.query(query, {
			noMetadata: true,
		});

		expect(deepSort(resWithoutMetadata, 'id')).toEqual(deepRemoveMetaData(expectedRes));
	});

	it('r6[relation nested] - relation connected to relation and a tunneled relation', async () => {
		expect(client).toBeDefined();
		const query = {
			$relation: 'UserTag',
		};
		const expectedRes = [
			{
				$id: 'tag-1',
				$relation: 'UserTag',
				color: 'yellow',
				group: 'utg-1',
				id: 'tag-1',
				users: ['user1'],
			},
			{
				$id: 'tag-2',
				$relation: 'UserTag',
				color: 'yellow',
				group: 'utg-1',
				id: 'tag-2',
				users: ['user1', 'user3'],
			},
			{
				$id: 'tag-3',
				$relation: 'UserTag',
				color: 'blue',
				group: 'utg-2',
				id: 'tag-3',
				users: ['user2'],
			},
			{
				$id: 'tag-4',
				$relation: 'UserTag',
				id: 'tag-4',
				users: ['user2'],
			},
		];
		const res = await client.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await client.query(query, {
			noMetadata: true,
		});

		expect(deepSort(resWithoutMetadata, 'id')).toEqual(deepRemoveMetaData(expectedRes));
	});

	it('r7[relation, nested, direct] - nested on nested', async () => {
		expect(client).toBeDefined();
		const query = {
			$relation: 'UserTag',
			$fields: [
				'id',
				{ $path: 'users', $fields: ['id', 'spaces'] },
				{ $path: 'group' },
				{ $path: 'color', $fields: ['id', 'user-tags', 'group'] },
			],
		};
		const expectedRes = [
			{
				$id: 'tag-1',
				id: 'tag-1',
				$relation: 'UserTag',
				color: {
					'$id': 'yellow',
					'$entity': 'Color',
					'id': 'yellow',
					'group': 'utg-1',
					'user-tags': ['tag-1', 'tag-2'],
				},
				group: {
					$id: 'utg-1',
					$relation: 'UserTagGroup',
					id: 'utg-1',
					color: 'yellow',
					tags: ['tag-1', 'tag-2'],
				},
				users: [
					{
						$id: 'user1',
						$entity: 'User',
						id: 'user1',
						spaces: ['space-1', 'space-2'],
					},
				],
			},
			{
				$id: 'tag-2',
				id: 'tag-2',
				$relation: 'UserTag',
				color: {
					'$id': 'yellow',
					'$entity': 'Color',
					'id': 'yellow',
					'group': 'utg-1',
					'user-tags': ['tag-1', 'tag-2'],
				},
				group: {
					$id: 'utg-1',
					$relation: 'UserTagGroup',
					id: 'utg-1',
					color: 'yellow',
					tags: ['tag-1', 'tag-2'],
				},
				users: [
					{
						$id: 'user1',
						$entity: 'User',
						id: 'user1',
						spaces: ['space-1', 'space-2'],
					},
					{ $id: 'user3', $entity: 'User', id: 'user3', spaces: ['space-2'] },
				],
			},
			{
				$id: 'tag-3',
				id: 'tag-3',
				$relation: 'UserTag',
				color: {
					'$id': 'blue',
					'$entity': 'Color',
					'id': 'blue',
					'group': 'utg-2',
					'user-tags': ['tag-3'],
				},
				group: {
					$id: 'utg-2',
					$relation: 'UserTagGroup',
					id: 'utg-2',
					color: 'blue',
					space: 'space-3',
					tags: ['tag-3'],
				},
				users: [
					{
						$id: 'user2',
						$entity: 'User',
						id: 'user2',
						spaces: ['space-2'],
					},
				],
			},
			{
				$id: 'tag-4',
				$relation: 'UserTag',
				id: 'tag-4',
				users: [
					{
						$entity: 'User',
						$id: 'user2',
						id: 'user2',
						spaces: ['space-2'],
					},
				],
			},
		];
		const res = await client.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await client.query(query, {
			noMetadata: true,
		});

		expect(deepSort(resWithoutMetadata, 'id')).toEqual(deepRemoveMetaData(expectedRes));
	});

	it('r8[relation, nested, deep] - deep nested', async () => {
		expect(client).toBeDefined();
		const query = {
			$entity: 'Space',
			$id: 'space-2',
			$fields: [
				'id',
				{
					$path: 'users',
					$id: 'user2',
					$fields: [
						'id',
						{ $path: 'user-tags', $fields: [{ $path: 'color', $fields: ['id', 'user-tags', 'group'] }, 'id'] },
					],
				},
			],
		};
		const expectedRes = {
			$entity: 'Space',
			$id: 'space-2',
			id: 'space-2',
			users: {
				'$entity': 'User',
				'$id': 'user2',
				'id': 'user2',
				'user-tags': [
					{
						$id: 'tag-3',
						id: 'tag-3',
						$relation: 'UserTag',
						color: {
							'$entity': 'Color',
							'$id': 'blue',
							'id': 'blue',
							'group': 'utg-2',
							'user-tags': ['tag-3'],
						},
					},
					{
						$id: 'tag-4',
						id: 'tag-4',
						$relation: 'UserTag',
					},
				],
			},
		};
		const res = await client.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await client.query(query, {
			noMetadata: true,
		});

		expect(deepSort(resWithoutMetadata, 'id')).toEqual(deepRemoveMetaData(expectedRes));
	});

	it('r9[relation, nested, ids]', async () => {
		expect(client).toBeDefined();
		const query = {
			$relation: 'UserTagGroup',
			$id: 'utg-1',
			$fields: ['tags', 'color'],
		};
		const res = await client.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual({
			$relation: 'UserTagGroup',
			$id: 'utg-1',
			tags: ['tag-1', 'tag-2'],
			color: 'yellow',
		});
	});

	it('ef1[entity] - $id single', async () => {
		expect(client).toBeDefined();
		const wrongRes = await client.query({ $entity: 'User', $id: uuidv4() });
		expect(wrongRes).toEqual(null);
		const validRes = await client.query({
			$entity: 'User',
			$id: 'user1',
			$fields: ['id'],
		});
		expect(validRes).toEqual({ $entity: 'User', $id: 'user1', id: 'user1' });
	});

	it('ef2[entity] - $id multiple', async () => {
		expect(client).toBeDefined();
		const res = await client.query({
			$entity: 'User',
			$id: ['user1', 'user2'],
			$fields: ['id'],
		});
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual([
			{ $entity: 'User', $id: 'user1', id: 'user1' },
			{ $entity: 'User', $id: 'user2', id: 'user2' },
		]);
	});

	it('ef3[entity] - $fields single', async () => {
		expect(client).toBeDefined();
		const res = await client.query({ $entity: 'User', $fields: ['id'] });
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual([
			{ $entity: 'User', $id: 'user1', id: 'user1' },
			{ $entity: 'User', $id: 'user2', id: 'user2' },
			{ $entity: 'User', $id: 'user3', id: 'user3' },
			{ $entity: 'User', $id: 'user4', id: 'user4' },
			{ $entity: 'User', $id: 'user5', id: 'user5' },
		]);
	});

	it('ef4[entity] - $fields multiple', async () => {
		expect(client).toBeDefined();
		const res = await client.query({
			$entity: 'User',
			$id: 'user1',
			$fields: ['name', 'email'],
		});
		expect(res).toEqual({
			$entity: 'User',
			$id: 'user1',
			name: 'Antoine',
			email: 'antoine@test.com',
		});
	});

	it('ef5[entity,filter] - $filter single', async () => {
		expect(client).toBeDefined();
		const res = await client.query({
			$entity: 'User',
			$filter: { name: 'Antoine' },
			$fields: ['name'],
		});
		// notice now it is an array. Multiple users could be called "Antoine"
		expect(res).toEqual([{ $entity: 'User', $id: 'user1', name: 'Antoine' }]);
	});

	// can also be the id field!
	it('ef6[entity,filter] - $filter by unique field', async () => {
		expect(client).toBeDefined();
		const res = await client.query({
			$entity: 'User',
			$filter: { id: 'user1' },
			$fields: ['name'],
		});
		expect(res).toEqual({ $entity: 'User', $id: 'user1', name: 'Antoine' });
	});

	it('ef7[entity,unique] - $filter unique field', async () => {
		expect(client).toBeDefined();
		const res = await client.query({
			$entity: 'User',
			$filter: { id: 'user1' }, // not $id, just being used as a regular field
			$fields: ['name', 'email'],
		});
		// and now its not an array again, we used at least one property in the filter that is either the single key specified in idFields: ['id'] or has a validations.unique:true
		expect(res).toEqual({
			$entity: 'User',
			$id: 'user1',
			name: 'Antoine',
			email: 'antoine@test.com',
		});
	});

	it('n1[nested] Only ids', async () => {
		expect(client).toBeDefined();
		const res = await client.query({
			$entity: 'User',
			$id: 'user1',
			$fields: ['name', 'accounts'],
		});
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual({
			$entity: 'User',
			$id: 'user1',
			name: 'Antoine',
			accounts: ['account1-1', 'account1-2', 'account1-3'],
		});
	});

	it('n2[nested] First level all fields', async () => {
		expect(client).toBeDefined();
		const query = {
			$entity: 'User',
			$id: 'user1',
			$fields: ['name', { $path: 'accounts' }],
		};
		const res = await client.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual({
			$entity: 'User',
			$id: 'user1',
			name: 'Antoine',
			accounts: [
				{
					$entity: 'Account',
					$id: 'account1-1',
					id: 'account1-1',
					provider: 'google',
					user: 'user1',
				},
				{
					$entity: 'Account',
					$id: 'account1-2',
					id: 'account1-2',
					provider: 'facebook',
					user: 'user1',
				},
				{
					$entity: 'Account',
					$id: 'account1-3',
					id: 'account1-3',
					provider: 'github',
					user: 'user1',
				},
			],
		});
		const resWithoutMetadata = await client.query(query, { noMetadata: true });

		expect(deepSort(resWithoutMetadata, 'id')).toEqual({
			name: 'Antoine',
			accounts: [
				{
					id: 'account1-1',
					provider: 'google',
					user: 'user1',
				},
				{
					id: 'account1-2',
					provider: 'facebook',
					user: 'user1',
				},
				{
					id: 'account1-3',
					provider: 'github',
					user: 'user1',
				},
			],
		});
	});

	it('n3[nested, $fields] First level filtered fields', async () => {
		expect(client).toBeDefined();
		const res = await client.query({
			$entity: 'User',
			$id: 'user1',
			$fields: ['name', { $path: 'accounts', $fields: ['provider'] }],
		});
		expect(res).toBeDefined();
		expect(deepSort(res)).toEqual({
			$entity: 'User',
			$id: 'user1',
			name: 'Antoine',
			accounts: [
				{ $entity: 'Account', $id: 'account1-1', provider: 'google' },
				{ $entity: 'Account', $id: 'account1-2', provider: 'facebook' },
				{ $entity: 'Account', $id: 'account1-3', provider: 'github' },
			],
		});
	});

	it('n4a[nested, $id] Local filter on nested, by id', async () => {
		expect(client).toBeDefined();
		const res = await client.query({
			$entity: 'User',
			$id: ['user1', 'user2', 'user3'],
			$fields: [
				'name',
				{
					$path: 'accounts',
					$id: 'account3-1', // id specified so nested children has to be an objec and not an array
					$fields: ['provider'],
				},
			],
		});

		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual([
			{
				$entity: 'User',
				$id: 'user1',
				name: 'Antoine',
			},
			{
				$entity: 'User',
				$id: 'user2',
				name: 'Loic',
			},
			{
				$entity: 'User',
				$id: 'user3',
				name: 'Ann',
				// accounts here has to be a single object, not an array because we specified an id in the nested query
				accounts: {
					$entity: 'Account',
					$id: 'account3-1',
					provider: 'facebook',
				},
			},
		]);
	});

	it('n4b[nested, $id] Local filter on nested depth two, by id', async () => {
		expect(client).toBeDefined();
		const res = await client.query({
			$entity: 'User',
			$id: 'user1',
			$fields: [
				{
					$path: 'spaces',
					$id: 'space-1', // id specified so nested children has to be an objec and not an array
					$fields: [{ $path: 'users', $id: 'user1', $fields: ['$id'] }],
				},
			],
		});
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual({
			$entity: 'User',
			$id: 'user1',
			spaces: {
				$id: 'space-1',
				$entity: 'Space',
				users: {
					$id: 'user1',
					$entity: 'User',
				},
			},
		});
	});

	it('nf1[nested, $filters] Local filter on nested, single id', async () => {
		expect(client).toBeDefined();
		const query = {
			$entity: 'User',
			$id: 'user1',
			$fields: ['name', { $path: 'accounts', $filter: { provider: 'github' } }],
		};
		const res = await client.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual({
			$entity: 'User',
			$id: 'user1',
			name: 'Antoine',
			accounts: [
				{
					$entity: 'Account',
					$id: 'account1-3',
					id: 'account1-3',
					provider: 'github',
					user: 'user1',
				},
			],
		});
	});

	it('nf2[nested, $filters] Local filter on nested, by field, multiple sources, some are empty', async () => {
		expect(client).toBeDefined();
		const res = await client.query({
			$entity: 'User',
			$id: ['user1', 'user2', 'user3'],
			$fields: [
				'name',
				{
					$path: 'accounts',
					$filter: { provider: 'google' },
					$fields: ['provider'],
				},
			],
		});
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res)).toEqual([
			{
				$entity: 'User',
				$id: 'user1',
				name: 'Antoine',
				accounts: [
					// array, we can't know it was only one
					{ $entity: 'Account', $id: 'account1-1', provider: 'google' },
				],
			},
			{
				$entity: 'User',
				$id: 'user2',
				name: 'Loic',
				accounts: [{ $entity: 'Account', $id: 'account2-1', provider: 'google' }],
			},
			{
				$entity: 'User',
				$id: 'user3',
				name: 'Ann',
			},
		]);
	});

	it('i1[inherired, attributes] Entity with inherited attributes', async () => {
		expect(client).toBeDefined();
		const res = await client.query({ $entity: 'God', $id: 'god1' }, { noMetadata: true });
		expect(res).toEqual({
			id: 'god1',
			name: 'Richard David James',
			email: 'afx@rephlex.com',
			power: 'mind control',
			isEvil: true,
		});
	});

	it('s1[self] Relation playing a a role defined by itself', async () => {
		expect(client).toBeDefined();
		const res = await client.query({ $relation: 'Self' }, { noMetadata: true });
		expect(deepSort(res, 'id')).toEqual([
			{ id: 'self1', owned: ['self2'], space: 'space-2' },
			{ id: 'self2', owned: ['self3', 'self4'], owner: 'self1', space: 'space-2' },
			{ id: 'self3', owner: 'self2', space: 'space-2' },
			{ id: 'self4', owner: 'self2', space: 'space-2' },
		]);
	});

	it('ex1[extends] Query where an object plays 3 different roles because it extends 2 types', async () => {
		/// note: fixed with an ugly workaround (getEntityName() in parseTQL.ts)
		expect(client).toBeDefined();

		const res = await client.query({ $entity: 'Space', $id: 'space-2' }, { noMetadata: true });

		expect(deepSort(res, 'id')).toEqual({
			objects: ['kind-book', 'self1', 'self2', 'self3', 'self4'],
			definitions: ['kind-book'],
			id: 'space-2',
			kinds: ['kind-book'],
			name: 'Dev',
			selfs: ['self1', 'self2', 'self3', 'self4'],
			users: ['user1', 'user2', 'user3'],
		});
	});

	it('ex2[extends] Query of the parent', async () => {
		/// note: fixed with an ugly workaround (getEntityName() in parseTQL.ts)
		expect(client).toBeDefined();

		const res = await client.query(
			{ $entity: 'Space', $id: 'space-2', $fields: [{ $path: 'objects', $fields: ['id'] }] },
			{ noMetadata: true },
		);
		expect(deepSort(res, 'id')).toEqual({
			objects: ['kind-book', 'self1', 'self2', 'self3', 'self4'],
		});
	});

	it('TODO:re1[repeated] Query with repeated path, different nested ids', async () => {
		expect(client).toBeDefined();

		const res = await client.query(
			{
				$entity: 'Space',
				$id: 'space-2',
				$fields: [
					{ $path: 'users', $id: 'user2', $fields: ['id', 'name'] },
					{ $path: 'users', $id: 'user3', $fields: ['id', { $path: 'accounts', $fields: ['id', 'provider'] }] },
				],
			},
			{ noMetadata: true },
		);

		expect(res).toEqual({
			$entity: 'Space',
			users: [
				{
					id: 'user2',
					name: 'user2name',
				},
				{
					id: 'user3',
					accounts: [{ id: 'accountZ', provider: 'whatever' }],
				},
			],
		});
	});

	it('TODO:re2[repeated] Query with repeated path, different nested patterns', async () => {
		expect(client).toBeDefined();

		const res = await client.query(
			{
				$entity: 'Space',
				$id: 'space-2',
				$fields: ['users', { $path: 'users', $id: 'user3', $fields: ['id', 'name'] }],
			},
			{ noMetadata: true },
		);

		expect(res).toEqual({
			$entity: 'Space',
			users: [
				'user2',
				{
					id: 'user3',
					name: 'user3name',
				},
				'user4',
			],
		});
	});

	it('xf1[excludedFields] Testing excluded fields', async () => {
		expect(client).toBeDefined();
		let godUser = {
			$entity: 'God',
			id: 'squarepusher',
			name: 'Tom Jenkinson',
			email: 'tom@warp.com',
			power: 'rhythm',
			isEvil: false,
		};
		// Create a new godUser
		const mutationRes = await client.mutate(godUser, { noMetadata: true });
		const [user] = mutationRes;

		expect(user).toEqual({
			id: expect.any(String),
			name: 'Tom Jenkinson',
			email: 'tom@warp.com',
			power: 'rhythm',
			isEvil: false,
		});
		godUser = { ...godUser, id: user.id };

		const queryRes = await client.query(
			{
				$entity: 'God',
				$id: godUser.id,
				$excludedFields: ['email', 'isEvil'],
			},
			{ noMetadata: true },
		);

		expect(queryRes).toEqual({
			id: godUser.id,
			name: 'Tom Jenkinson',
			power: 'rhythm',
		});
	});

	it('TODO:xf2[excludedFields, deep] - deep nested', async () => {
		expect(client).toBeDefined();
		const query = {
			$entity: 'Space',
			$id: 'space-2',
			$fields: [
				'id',
				{
					$path: 'users',
					$id: 'user2',
					$fields: ['id', { $path: 'user-tags', $fields: [{ $path: 'color', $excludedFields: ['id'] }, 'id'] }],
				},
			],
		};
		const expectedRes = {
			$entity: 'Space',
			$id: 'space-2',
			id: 'space-2',
			users: {
				'$entity': 'User',
				'$id': 'user2',
				'id': 'user2',
				'user-tags': [
					{
						$id: 'tag-3',
						id: 'tag-3',
						$relation: 'UserTag',
						color: {
							'$entity': 'Color',
							'$id': 'blue',
							'id': 'blue',
							'group': 'utg-2',
							'user-tags': ['tag-3'],
							'isBlue': true,
						},
					},
					{
						$id: 'tag-4',
						id: 'tag-4',
						$relation: 'UserTag',
					},
				],
			},
		};
		const res = await client.query(query);
		expect(res).toBeDefined();
		expect(res).not.toBeInstanceOf(String);

		expect(deepSort(res, 'id')).toEqual(expectedRes);
		const resWithoutMetadata = await client.query(query, {
			noMetadata: true,
		});

		expect(deepSort(resWithoutMetadata, 'id')).toEqual(deepRemoveMetaData(expectedRes));
	});

	it('v1[virtual] Virtual field', async () => {
		/// note: fixed with an ugly workaround (getEntityName() in parseTQL.ts)
		expect(client).toBeDefined();

		const res = await client.query(
			{ $entity: 'Color', $id: ['blue', 'yellow'], $fields: ['id', 'isBlue'] },
			{ noMetadata: true },
		);
		expect(deepSort(res, 'id')).toEqual([
			{
				id: 'blue',
				isBlue: true,
			},
			{
				id: 'yellow',
				isBlue: false,
			},
		]);
	});

	/*
  it('[entity,nested, filter] - $filter on children property', async () => {
    expect(client).toBeDefined();
    const res = await client.query({
      $entity: 'User',
      // this adds: $filterByAccounts isa account, has Account·provider 'github'; $filterRel (account: $filterByAccounts , user: $users) isa User-Accounts;
      $filter: { account: { provider: { $eq: 'github' } } }, // $ is always commands, by default is $eq
      $fields: ['name'],
    });
    expect(res).toEqual({
      $entity: 'User',
      $id: 'user1',
      name: 'Antoine',
    });
  });
  it('[entity,nested,filter] - Simplified filter', async () => {
    expect(client).toBeDefined();
    const res = await client.query({
      $entity: 'User',
      $filter: { account: { provider: 'github' } }, // by default is $eq
      $fields: ['name'],
    });
    expect(res).toEqual([
      {
        $entity: 'User',
        $id: 'user1',
        name: 'Antoine',
      },
    ]);
  });
  it('[entity,array,includes] - filter by field of cardinality many, type text: includes one ', async () => {
    expect(client).toBeDefined();
    const res = await client.query({
      $entity: 'post',
      $filter: { mentions: { $includes: '@antoine' } },
      $fields: ['id'],
    });
    expect(res).toBeDefined();
    expect(res).not.toBeInstanceOf(String);
    
    // when we have no way to know if the answer will be unique or not, we provide an array
    expect(deepSort(res)).toEqual([
      { $entity: 'post', $id: 'post1', id: 'post1' },
      { $entity: 'post', $id: 'post2', id: 'post2' },
    ]);
  });
  it('[entity,array,includesAll] - filter by field of cardinality many, type text: includes all ', async () => {
    expect(client).toBeDefined();
    const res = await client.query({
      $entity: 'post',
      $filter: { mentions: { $includesAll: ['@Antoine', '@Loic'] } },
      $fields: ['id'],
    });
    expect(res).toBeDefined();
    expect(res).not.toBeInstanceOf(String);
    
    expect(deepSort(res)).toEqual([
      { $entity: 'post', $id: 'post2', id: 'post2' },
      { $entity: 'post', $id: 'post3', id: 'post3' },
    ]);
  });
  it('[entity,array,includesAny] filter by field of cardinality many, type text: includes any ', async () => {
    expect(client).toBeDefined();
    const res = await client.query({
      $entity: 'post',
      $filter: { mentions: { $includesAny: ['@Antoine', '@Loic'] } },
      $fields: ['id'],
    });
    expect(res).toBeDefined();
    expect(res).not.toBeInstanceOf(String);
    
    expect(deepSort(res)).toEqual([
      { $entity: 'post', $id: 'post1', id: 'post1' },
      { $entity: 'post', $id: 'post2', id: 'post2' },
      { $entity: 'post', $id: 'post3', id: 'post3' },
    ]);
  });
  it('[entity,includesAny,error] using array filter includesAny on cardinality=ONE error', async () => {
    expect(client).toBeDefined();
    const res = await client.query({
      $entity: 'User',
      $filter: { name: { $includesAny: ['x', 'y'] } },
    });
    expect(res).toThrow(TypeError);
  });
  it('[entity,includesAll, error] using array filter includesAll on cardinality=ONE error', async () => {
    expect(client).toBeDefined();
    const res = await client.query({
      $entity: 'User',
      $filter: { name: { $includesAll: ['x', 'y'] } },
    });
    expect(res).toThrow(TypeError);
  });
  // OPERATORS: NOT
  it('[entity,filter,not] - filter by field', async () => {
    expect(client).toBeDefined();
    const res = await client.query({
      $entity: 'User',
      $filter: { $not: { id: 'user1' } },
      $fields: ['id'],
    });
    expect(res).toBeDefined();
    expect(res).not.toBeInstanceOf(String);
    
    expect(deepSort(res)).toEqual([
      { $entity: 'User', $id: 'user2', id: 'user2' },
      { $entity: 'User', $id: 'user2', id: 'user3' },
    ]);
  });
  it('[entity,filter,not,array,includes] filter item cardinality many', async () => {
    expect(client).toBeDefined();
    const res = await client.query({
      $entity: 'post',
      $filter: { mentions: { $not: { $includes: '@Antoine' } } },
      $fields: ['id'],
    });
    expect(res).toEqual([{ $entity: 'post', $id: 'post3', id: 'post3' }]); // this is an array because we can't be sure before querying that is a single element
  });
  // OPERATORS: OR
  // typeDB: https://docs.vaticle.com/docs/query/match-clause#disjunction-of-patterns. When is the same
  it('[entity,OR] or filter two different fields', async () => {
    expect(client).toBeDefined();
    const res = await client.query({
      $entity: 'User',
      $filter: [{ name: 'Loic' }, { email: 'antoine@test.com' }], // this is equivalent to $filter: {$or: [..]}
      $fields: ['name'],
    });
    expect(res).toBeDefined();
    expect(res).not.toBeInstanceOf(String);
    
    expect(deepSort(res)).toEqual([
      { $entity: 'User', $id: 'user1', name: 'Antoine' },
      { $entity: 'User', $id: 'user2', name: 'Loic' },
    ]);
  });
  */

	// NESTED

	afterAll(async () => {
		await cleanup(dbName);
	});
});
