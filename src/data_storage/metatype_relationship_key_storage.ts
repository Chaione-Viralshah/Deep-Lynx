import Result from "../result"
import PostgresStorage from "./postgresStorage";
import {QueryConfig} from "pg";
import * as t from "io-ts";
import PostgresAdapter from "./adapters/postgres/postgres";
import {
    MetatypeRelationshipKeyT, metatypeRelationshipKeysT,
    MetatypeRelationshipKeysT
} from "../types/metatype_relationship_keyT";

/*
* MetatypeRelationshipKeyStorage encompasses all logic dealing with the manipulation of the Metatype_key
* class in a data storage layer. In this case, the storage class requires a graph
* storage interface.
*/
export default class MetatypeRelationshipKeyStorage extends PostgresStorage{
    public static tableName = "metatype_relationship_keys";

    private static instance: MetatypeRelationshipKeyStorage;

    public static get Instance(): MetatypeRelationshipKeyStorage {
        if(!MetatypeRelationshipKeyStorage.instance) {
            MetatypeRelationshipKeyStorage.instance = new MetatypeRelationshipKeyStorage()
        }

        return MetatypeRelationshipKeyStorage.instance
    }

    // Create accepts a single object, or array of objects. The function will validate
    // if those objects are a valid type and will return a detailed error message
    // if not
    public async Create(metatypeRelationshipID: string, userID:string, input:any | MetatypeRelationshipKeysT): Promise<Result<MetatypeRelationshipKeysT>> {
        // onValidateSuccess is a callback that happens after the input has been
        // validated and confirmed to be of the MetatypeRelationshipKey(s) type
        const onValidateSuccess = ( resolve: (r:any) => void): (c: MetatypeRelationshipKeysT)=> void => {
            return async (ms:MetatypeRelationshipKeysT) => {
                const queries: QueryConfig[] = [];

                for(const i in ms) {
                    ms[i].metatype_relationship_id = metatypeRelationshipID;
                    ms[i].id = super.generateUUID();

                    ms[i].created_by = userID;
                    ms[i].modified_by = userID;

                    queries.push(MetatypeRelationshipKeyStorage.createStatement(ms[i]))
                }

                super.runAsTransaction(...queries)
                    .then((r) => {
                        if(r.isError) {
                            resolve(r);
                            return
                        }

                        resolve(Result.Success(ms))
                    })
            }
        };

        // allows us to accept an array of input if needed
        const payload = (t.array(t.unknown).is(input)) ? input : [input];

        return super.decodeAndValidate<MetatypeRelationshipKeysT>(metatypeRelationshipKeysT, onValidateSuccess, payload)
    }

    public Retrieve(id: string): Promise<Result<MetatypeRelationshipKeyT>> {
        return super.retrieve<MetatypeRelationshipKeyT>(MetatypeRelationshipKeyStorage.retrieveStatement(id))
    }

    public List(metatypeRelationshipID: string): Promise<Result<MetatypeRelationshipKeyT[]>> {
        return super.rows<MetatypeRelationshipKeyT>(MetatypeRelationshipKeyStorage.listStatement(metatypeRelationshipID))
    }

    // Update partially updates the MetatypeRelationshipKey. This function will allow you to
    // rewrite foreign keys - this is by design. The storage layer is dumb, whatever
    // uses the storage layer should be what enforces user privileges etc.
    public async Update(id: string, userID: string, updatedField: {[key:string]: any}): Promise<Result<boolean>> {
        const toUpdate = await this.Retrieve(id);

        if(toUpdate.isError) {
            return new Promise(resolve => resolve(Result.Failure(toUpdate.error!.error)))
        }

        const updateStatement:string[] = [];
        const values:string[] = [];
        let i = 1;

        Object.keys(updatedField).map(k => {
            updateStatement.push(`${k} = $${i}`);
            values.push(updatedField[k]);
            i++
        });

        updateStatement.push(`modified_by = $${i}`);
        values.push(userID);

        return new Promise(resolve => {
            PostgresAdapter.Instance.Pool.query({
                text: `UPDATE metatype_relationship_keys SET ${updateStatement.join(",")} WHERE id = '${id}'`,
                values
            })
                .then(() => {
                    resolve(Result.Success(true))
                })
                .catch(e => resolve(Result.Failure(e)))
        })

    }

    // BatchUpdate accepts multiple MetatypeRelationshipKey(s) payloads for full update
    public async BatchUpdate(userID: string, input:any | MetatypeRelationshipKeysT): Promise<Result<MetatypeRelationshipKeysT>> {
        const onSuccess = ( resolve: (r:any) => void): (c: MetatypeRelationshipKeysT)=> void => {
            return async (ms:MetatypeRelationshipKeysT) => {
                const queries: QueryConfig[] = [];

                for(const i in ms) {
                    ms[i].modified_by = userID;

                    queries.push(MetatypeRelationshipKeyStorage.fullUpdateStatement(ms[i]))
                }

                super.runAsTransaction(...queries)
                    .then((r) => {
                        if(r.isError) {
                            resolve(r);
                            return
                        }

                        resolve(Result.Success(ms))
                    })
            }
        };

        // allows us to accept an array of input if needed
        const payload = (t.array(t.unknown).is(input)) ? input : [input];

        return super.decodeAndValidate<MetatypeRelationshipKeysT>(metatypeRelationshipKeysT, onSuccess, payload)
    }

    public PermanentlyDelete(id: string): Promise<Result<boolean>> {
        return super.run(MetatypeRelationshipKeyStorage.deleteStatement(id))
    }

    public Archive(id: string, userID: string): Promise<Result<boolean>> {
        return super.run(MetatypeRelationshipKeyStorage.archiveStatement(id, userID))
    }

    // Below are a set of query building functions. So far they're very simple
    // and the return value is something that the postgres-node driver can understand
    // My hope is that this method will allow us to be flexible and create more complicated
    // queries more easily.
    private static createStatement(key: MetatypeRelationshipKeyT): QueryConfig {
        return {
            text:`INSERT INTO metatype_relationship_keys(metatype_relationship_id, id, name, description, property_name, required, data_type, options, default_value, created_by, modified_by)
VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            values: [key.metatype_relationship_id, key.id, key.name, key.description,
                key.property_name, key.required, key.data_type, key.options,
                key.default_value, key.created_by, key.modified_by]
        }
    }

    private static retrieveStatement(metatypeKeyID:string): QueryConfig {
        return {
            text:`SELECT * FROM metatype_relationship_keys WHERE id = $1 AND NOT ARCHIVED`,
            values: [metatypeKeyID]
        }
    }

    private static archiveStatement(metatypeKeyID: string, userID: string): QueryConfig {
        return {
            text:`UPDATE metatype_relationship_keys SET archived = true, modified_by = $2  WHERE id = $1`,
            values: [metatypeKeyID, userID]
        }
    }

    private static deleteStatement(metatypeKeyID: string): QueryConfig {
        return {
            text:`DELETE FROM metatype_relationship_keys WHERE id = $1`,
            values: [metatypeKeyID]
        }
    }

    private static listStatement(metatypeID:string): QueryConfig {
        return {
            text: `SELECT * FROM metatype_relationship_keys WHERE metatype_relationship_id = $1 AND NOT archived `,
            values: [metatypeID]
        }
    }

    private static fullUpdateStatement(key: MetatypeRelationshipKeyT): QueryConfig {
        return {
            text:`UPDATE metatype_relationship_keys SET name = $1,
                 description = $2,
                 property_name = $3,
                 required = $4,
                 data_type = $5,
                 options = $6,
                 default_value = $7
                 WHERE id = $8`,
            values: [key.name, key.description,
                key.property_name, key.required, key.data_type, key.options,
                key.default_value, key.id]
        }
    }
}
