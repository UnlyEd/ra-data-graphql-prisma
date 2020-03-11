import { ApolloClient, ApolloClientOptions } from 'apollo-client';
import camelCase from 'lodash/camelCase';
import merge from 'lodash/merge';
import pluralize from 'pluralize';
import { CREATE, DELETE, DELETE_MANY, GET_LIST, GET_MANY, GET_MANY_REFERENCE, GET_ONE, UPDATE, UPDATE_MANY } from 'ra-core';

import buildDataProvider, { GraphQLDataProvider } from 'ra-data-graphql';

import prismaBuildQuery from './buildQuery';
import { Resource } from './constants/interfaces';
import { DeleteManyParams, GetManyParams, Params, UpdateManyParams } from './types/Params';

export const buildQuery = prismaBuildQuery;

const defaultOptions = {
  buildQuery,
  introspection: {
    operationNames: {
      [GET_LIST]: (resource: Resource): string =>
        `${pluralize(camelCase(resource.name))}`,
      [GET_ONE]: (resource: Resource): string => `${camelCase(resource.name)}`,
      [GET_MANY]: (resource: Resource): string =>
        `${pluralize(camelCase(resource.name))}`,
      [GET_MANY_REFERENCE]: (resource: Resource): string =>
        `${pluralize(camelCase(resource.name))}`,
      [CREATE]: (resource: Resource): string => `create${resource.name}`,
      [UPDATE]: (resource: Resource): string => `update${resource.name}`,
      [DELETE]: (resource: Resource): string => `delete${resource.name}`,
    },
    exclude: undefined,
    include: undefined,
  },
};

//TODO: Prisma supports batching (UPDATE_MANY, DELETE_MANY)
export default (options: {
  client?: ApolloClient<any>;
  clientOptions?: ApolloClientOptions<any>;
  debug?: boolean;
}) => {
  return buildDataProvider(merge({}, defaultOptions, options)).then(
    (graphQLDataProvider: GraphQLDataProvider) => {
      return async (
        fetchType: string,
        resource: string,
        params: Params,
      ): Promise<any> => {
        // XXX Temporary work-around until we make use of updateMany and deleteMany mutations
        //  Currently perform one request/mutation per record instead of performing all mutations at once in the same request
        //  GraphCMS supports bulk delete/update so it could be implemented properly
        if (fetchType === DELETE_MANY) {
          const { ids, ...otherParams } = params as DeleteManyParams;
          return Promise.all(
            ids.map((id: string) =>
              graphQLDataProvider(DELETE, resource, {
                id,
                ...otherParams,
              }),
            ),
          ).then((results) => {
            return { data: results.map(({ data }: any) => data.id) };
          });
        }

        if (fetchType === UPDATE_MANY) {
          const { ids, ...otherParams } = params as UpdateManyParams;
          return Promise.all(
            ids.map((id: string) =>
              graphQLDataProvider(UPDATE, resource, {
                id,
                ...otherParams,
              }),
            ),
          ).then((results) => {
            return { data: results.map(({ data }: any) => data.id) };
          });
        }
        const res = await graphQLDataProvider(fetchType, resource, params);

        if (options.debug) {
          // eslint-disable-next-line no-console
          console.debug('ra-data-graphql-prisma - results', res);
        }

        return res;
      };
    },
  );
};
