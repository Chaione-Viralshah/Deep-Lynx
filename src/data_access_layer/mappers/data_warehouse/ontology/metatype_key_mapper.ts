import Result from '../../../../common_classes/result';
import Mapper from '../../mapper';
import {PoolClient, QueryConfig} from 'pg';
import MetatypeKey from '../../../../domain_objects/data_warehouse/ontology/metatype_key';

const format = require('pg-format');

/*
    MetatypeKeyMapper extends the Postgres database Mapper class and allows
    the user to map a data structure to and from the attached database. The mappers
    are designed to be as simple as possible and should not contain things like
    validation or transformation of the data prior to storage - those operations
    should live in a Repository or on the data structure's class itself. Also
    try to avoid listing functions, as those are generally covered by the Repository
    class/interface as well.
*/
export default class MetatypeKeyMapper extends Mapper {
    public resultClass = MetatypeKey;
    public static tableName = 'metatype_keys';

    private static instance: MetatypeKeyMapper;

    public static get Instance(): MetatypeKeyMapper {
        if (!MetatypeKeyMapper.instance) {
            MetatypeKeyMapper.instance = new MetatypeKeyMapper();
        }

        return MetatypeKeyMapper.instance;
    }

    public async Create(userID: string, key: MetatypeKey, transaction?: PoolClient): Promise<Result<MetatypeKey>> {
        const r = await super.run(this.createStatement(userID, key), {
            transaction,
            resultClass: this.resultClass,
        });
        if (r.isError) return Promise.resolve(Result.Pass(r));

        return Promise.resolve(Result.Success(r.value[0]));
    }

    public async BulkCreate(userID: string, keys: MetatypeKey[], transaction?: PoolClient): Promise<Result<MetatypeKey[]>> {
        return super.run(this.createStatement(userID, ...keys), {
            transaction,
            resultClass: this.resultClass,
        });
    }

    public async Retrieve(id: string): Promise<Result<MetatypeKey>> {
        return super.retrieve(this.retrieveStatement(id), {resultClass: this.resultClass});
    }

    public async ListForMetatype(metatypeID: string): Promise<Result<MetatypeKey[]>> {
        return super.rows(this.listStatement(metatypeID), {resultClass: this.resultClass});
    }

    public async ListForMetatypeIDs(metatype_ids: string[]): Promise<Result<MetatypeKey[]>> {
        return super.rows(this.listKeysStatement(metatype_ids));
    }

    public async ListFromIDs(ids: string[]): Promise<Result<MetatypeKey[]>> {
        return super.rows(this.listFromIDsStatement(ids), {resultClass: this.resultClass});
    }

    public async Update(userID: string, key: MetatypeKey, transaction?: PoolClient): Promise<Result<MetatypeKey>> {
        const r = await super.run(this.fullUpdateStatement(userID, key), {
            transaction,
            resultClass: this.resultClass,
        });
        if (r.isError) return Promise.resolve(Result.Pass(r));

        return Promise.resolve(Result.Success(r.value[0]));
    }

    public async BulkUpdate(userID: string, keys: MetatypeKey[], transaction?: PoolClient): Promise<Result<MetatypeKey[]>> {
        return super.run(this.fullUpdateStatement(userID, ...keys), {
            transaction,
            resultClass: this.resultClass,
        });
    }

    public async Delete(id: string): Promise<Result<boolean>> {
        return super.runStatement(this.deleteStatement(id));
    }

    public async BulkDelete(keys: MetatypeKey[], transaction?: PoolClient): Promise<Result<boolean>> {
        return super.runStatement(this.bulkDeleteStatement(keys), {
            transaction,
        });
    }

    public async Archive(id: string, userID: string): Promise<Result<boolean>> {
        return super.runStatement(this.archiveStatement(id, userID));
    }

    public async Unarchive(id: string, userID: string): Promise<Result<boolean>> {
        return super.runStatement(this.unarchiveStatement(id, userID));
    }

    // Below are a set of query building functions. So far they're very simple
    // and the return value is something that the postgres-node driver can understand
    // My hope is that this method will allow us to be flexible and create more complicated
    // queries more easily.
    private createStatement(userID: string, ...keys: MetatypeKey[]): string {
        const text = `INSERT INTO
                        metatype_keys(
                                      metatype_id,
                                      container_id,
                                      name,
                                      description,
                                      property_name,
                                      required,
                                      data_type,
                                      options,
                                      default_value,
                                      validation,
                                      created_by,
                                      modified_by)
                        VALUES %L RETURNING *`;
        const values = keys.map((key) => [
            key.metatype_id,
            key.container_id,
            key.name,
            key.description,
            key.property_name,
            key.required,
            key.data_type,
            JSON.stringify(key.options),
            JSON.stringify(key.default_value),
            JSON.stringify(key.validation),
            userID,
            userID,
        ]);

        return format(text, values);
    }

    private retrieveStatement(metatypeKeyID: string): QueryConfig {
        return {
            text: `SELECT * FROM metatype_keys WHERE id = $1`,
            values: [metatypeKeyID],
        };
    }

    private listFromIDsStatement(ids: string[]): string {
        const text = `SELECT * FROM metatype_keys WHERE id IN(%L)`;
        const values = ids;

        return format(text, values);
    }

    private archiveStatement(metatypeKeyID: string, userID: string): QueryConfig {
        return {
            text: `UPDATE metatype_keys SET deleted_at = NOW(), modified_at = NOW(), modified_by = $2  WHERE id = $1`,
            values: [metatypeKeyID, userID],
        };
    }

    private unarchiveStatement(metatypeKeyID: string, userID: string): QueryConfig {
        return {
            text: `UPDATE metatype_keys SET deleted_at = NULL, modified_at = NOW(), modified_by = $2  WHERE id = $1`,
            values: [metatypeKeyID, userID],
        };
    }

    private bulkDeleteStatement(keys: MetatypeKey[]): string {
        const text = `DELETE FROM metatype_keys WHERE id IN(%L)`;
        const values = keys.filter((k) => k.id).map((k) => k.id as string);

        return format(text, values);
    }

    private deleteStatement(metatypeKeyID: string): QueryConfig {
        return {
            text: `DELETE FROM metatype_keys WHERE id = $1`,
            values: [metatypeKeyID],
        };
    }

    // list statement must reference the get_metatype_keys function so that we are getting
    // all keys back, both the metatype's own and the inherited keys
    private listStatement(metatypeID: string): QueryConfig {
        return {
            text: `SELECT * FROM get_metatype_keys($1::bigint) ORDER BY name`,
            values: [metatypeID],
        };
    }

    private listKeysStatement(metatype_ids: string[]): QueryConfig {
        const text = `WITH RECURSIVE parents AS (
                SELECT id, container_id, name, description, created_at, 
                    modified_at, created_by, modified_by, ontology_version, 
                    old_id, deleted_at, id AS key_parent, 1 AS lvl
                FROM metatypes_view
                    UNION
                SELECT v.id, v.container_id, v.name, v.description, v.created_at,
                    v.modified_at, v.created_by, v.modified_by, v.ontology_version,
                    v.old_id, v.deleted_at, p.key_parent, p.lvl + 1
                FROM parents p JOIN metatypes_view v ON p.id = v.parent_id
            ) SELECT mk.id, p.id AS metatype_id, mk.name, mk.description, 
                mk.required, mk.property_name, mk.data_type, mk.options, 
                mk.default_value, mk.validation, mk.created_at, mk.modified_at,
                mk.created_by, mk.modified_by, mk.ontology_version, 
                mk.container_id, mk.deleted_at
            FROM parents p JOIN metatype_keys mk ON p.key_parent = mk.metatype_id
            WHERE p.id IN (%L)
            ORDER BY metatype_id, mk.name`;
        const values = metatype_ids;
        return format(text, values);
    }

    private fullUpdateStatement(userID: string, ...keys: MetatypeKey[]): string {
        const text = `UPDATE metatype_keys AS m SET
                     name = k.name,
                     metatype_id = k.metatype_id::bigint,
                     container_id = k.container_id::bigint, 
                     description = k.description,
                     property_name = k.property_name,
                     required = k.required::boolean,
                     data_type = k.data_type,
                     options = k.options::jsonb,
                     default_value = k.default_value::jsonb,
                     validation = k.validation::jsonb,
                     modified_by = k.modified_by,
                     modified_at = NOW()
                 FROM(VALUES %L) AS 
                     k(id, name, metatype_id, container_id, description, property_name, required, data_type, options, default_value, validation, modified_by)
                 WHERE k.id::bigint = m.id RETURNING m.*`;
        const values = keys.map((key) => [
            key.id,
            key.name,
            key.metatype_id,
            key.container_id,
            key.description,
            key.property_name,
            key.required,
            key.data_type,
            JSON.stringify(key.options),
            JSON.stringify(key.default_value),
            JSON.stringify(key.validation),
            userID,
        ]);

        return format(text, values);
    }
}
