import type { Filter } from './filters';

type RequiredKey<T, K extends keyof T> = T & { [P in K]-?: T[P] };

type WithRequired<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>> & RequiredKey<T, K>;

export type BQLMutationBlock = {
	[key: string]: any;
	$id?: string | string[];
	$filter?: Filter | Filter[]; // todo: keyof BQLmutationBlock
	$tempId?: string;
	$op?: string;
} & ({ $entity: string } | { $relation: string }); // | { $attribute: string });
export type FilledBQLMutationBlock = WithRequired<BQLMutationBlock, '$tempId' | '$op'>;

export type RawBQLMutation<T extends Record<string, any> = Record<string, any>> = (
	| {
			$id?: string;
			$op?: 'create' | 'delete' | 'update'; //link and unlink can't happen in the root level but we will need to do a full tree type later that includes metadata
			$tempId?: string;
	  }
	| {
			$entity: string;
	  }
	| {
			$relation: string;
	  }
) &
	T; /// TODO : explicitly type available fields

export type ParsedBQLMutation = {
	things: BQLMutationBlock[];
	edges: BQLMutationBlock[];
};
