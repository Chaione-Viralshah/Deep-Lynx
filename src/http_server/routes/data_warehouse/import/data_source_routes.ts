import {Application, NextFunction, Request, Response} from 'express';
import {authInContainer} from '../../../middleware';
import {plainToClass} from 'class-transformer';
import DataSourceRecord from '../../../../domain_objects/data_warehouse/import/data_source';
import Result from '../../../../common_classes/result';
import DataSourceRepository, {DataSourceFactory} from '../../../../data_access_layer/repositories/data_warehouse/import/data_source_repository';
import {QueryOptions} from '../../../../data_access_layer/repositories/repository';
import DataStagingRepository from '../../../../data_access_layer/repositories/data_warehouse/import/data_staging_repository';

const dataSourceRepo = new DataSourceRepository();
const dataSourceFactory = new DataSourceFactory();

// This contains all routes pertaining to DataSources.
export default class DataSourceRoutes {
    public static mount(app: Application, middleware: any[]) {
        app.post('/containers/:containerID/import/datasources', ...middleware, authInContainer('write', 'data'), this.createDataSource);
        app.get('/containers/:containerID/import/datasources', ...middleware, authInContainer('read', 'data'), this.listDataSources);
        app.get('/containers/:containerID/import/datasources/:sourceID', ...middleware, authInContainer('read', 'data'), this.retrieveDataSource);
        app.put('/containers/:containerID/import/datasources/:sourceID', ...middleware, authInContainer('write', 'data'), this.updateDataSource);
        app.delete('/containers/:containerID/import/datasources/:sourceID', ...middleware, authInContainer('write', 'data'), this.deleteDataSource);

        app.get('/containers/:containerID/import/datasources/:sourceID/data', ...middleware, authInContainer('read', 'data'), this.dataCount);

        app.post('/containers/:containerID/import/datasources/:sourceID/active', ...middleware, authInContainer('write', 'data'), this.setActive);
        app.delete('/containers/:containerID/import/datasources/:sourceID/active', ...middleware, authInContainer('write', 'data'), this.setInactive);

        app.post('/containers/:containerID/import/datasources/:sourceID/reprocess', ...middleware, authInContainer('write', 'data'), this.reprocessDataSource);
    }

    private static createDataSource(req: Request, res: Response, next: NextFunction) {
        if (req.container) {
            const currentUser = req.currentUser!;

            const payload = plainToClass(DataSourceRecord, req.body as object);
            payload.container_id = req.container.id!;

            const dataSource = dataSourceFactory.fromDataSourceRecord(payload);
            if (!dataSource) {
                // we make an assumption here as to why this fails - it's a fairly
                // safe assumption as that's the only way this could actually fail
                Result.Failure(`unknown data source adapter type`).asResponse(res);
                next();
                return;
            }

            dataSourceRepo
                .save(dataSource, currentUser)
                .then((result) => {
                    if (result.isError) {
                        result.asResponse(res);
                        return;
                    }

                    Result.Success(dataSource.DataSourceRecord).asResponse(res);
                })
                .catch((err) => {
                    Result.Error(err).asResponse(res);
                })
                .finally(() => next());
        } else {
            Result.Failure(`unable to find container`).asResponse(res);
            next();
        }
    }

    private static updateDataSource(req: Request, res: Response, next: NextFunction) {
        if (req.container && req.dataSource && req.dataSource.DataSourceRecord) {
            const currentUser = req.currentUser!;

            Object.assign(req.dataSource.DataSourceRecord, req.body as object);

            dataSourceRepo
                .save(req.dataSource, currentUser)
                .then((result) => {
                    if (result.isError) {
                        result.asResponse(res);
                        return;
                    }

                    Result.Success(req.dataSource?.DataSourceRecord).asResponse(res);
                })
                .catch((err) => {
                    Result.Error(err).asResponse(res);
                })
                .finally(() => next());
        } else {
            Result.Failure(`unable to find container or data source `).asResponse(res);
            next();
        }
    }

    private static dataCount(req: Request, res: Response, next: NextFunction) {
        if (req.dataSource) {
            const stagingRepo = new DataStagingRepository();

            stagingRepo
                .where()
                .dataSourceID('eq', req.dataSource.DataSourceRecord?.id)
                .count()
                .then((count) => {
                    count.asResponse(res);
                    next();
                })
                .catch((err) => {
                    Result.Error(err).asResponse(res);
                });
        } else {
            Result.Failure(`unable to find data source`, 404).asResponse(res);
            next();
        }
    }

    private static retrieveDataSource(req: Request, res: Response, next: NextFunction) {
        if (req.dataSource) {
            Result.Success(req.dataSource.DataSourceRecord).asResponse(res);
            next();
        } else {
            Result.Failure(`unable to find data source`, 404).asResponse(res);
            next();
        }
    }

    private static setActive(req: Request, res: Response, next: NextFunction) {
        if (req.dataSource) {
            dataSourceRepo
                .setActive(req.dataSource, req.currentUser!)
                .then((result) => {
                    result.asResponse(res);
                })
                .catch((err) => {
                    Result.Error(err).asResponse(res);
                })
                .finally(() => next());
        } else {
            Result.Failure(`unable to find data source`, 404).asResponse(res);
            next();
        }
    }

    private static setInactive(req: Request, res: Response, next: NextFunction) {
        if (req.dataSource) {
            dataSourceRepo
                .setInactive(req.dataSource, req.currentUser!)
                .then((result) => {
                    result.asResponse(res);
                })
                .catch((err) => {
                    Result.Error(err).asResponse(res);
                })
                .finally(() => next());
        } else {
            Result.Failure(`unable to find data source`, 404).asResponse(res);
            next();
        }
    }

    private static listDataSources(req: Request, res: Response, next: NextFunction) {
        let repository = new DataSourceRepository();
        repository = repository.where().containerID('eq', req.container!.id!);

        if (req.query.count !== undefined) {
            if (String(req.query.count).toLowerCase() === 'true') {
                repository
                    .count()
                    .then((result) => {
                        result.asResponse(res);
                    })
                    .catch((err) => {
                        Result.Failure(err, 404).asResponse(res);
                    })
                    .finally(() => next());
            }
        } else {
            repository
                .and()
                .timeseries(String(req.query.timeseries).toLowerCase() === 'true')
                .and()
                .archived(String(req.query.archived).toLowerCase() === 'true')
                .or()
                .timeseries(String(req.query.timeseries).toLowerCase() === 'true')
                .and()
                .containerID('eq', req.container!.id) // we have to specify the container again in an OR statement
                .and()
                .archived(false) // we always want to at least list all unarchived ones
                .list({
                    limit: req.query.limit ? +req.query.limit : undefined,
                    offset: req.query.offset ? +req.query.offset : undefined,
                    sortBy: req.query.sortBy,
                    sortDesc: req.query.sortDesc ? String(req.query.sortDesc).toLowerCase() === 'true' : undefined,
                } as QueryOptions)
                .then((result) => {
                    if (result.isError) {
                        result.asResponse(res);
                        return;
                    }

                    Result.Success(result.value.map((source) => source?.DataSourceRecord!)).asResponse(res);
                })
                .catch((err) => {
                    Result.Failure(err, 404).asResponse(res);
                })
                .finally(() => next());
        }
    }

    private static deleteDataSource(req: Request, res: Response, next: NextFunction) {
        if (req.dataSource && String(req.query.archive).toLowerCase() === 'true') {
            dataSourceRepo
                .archive(req.currentUser!, req.dataSource)
                .then((result) => {
                    result.asResponse(res);
                })
                .catch((err) => {
                    Result.Error(err).asResponse(res);
                })
                .finally(() => next());
        } else if (req.dataSource) {
            dataSourceRepo
                .delete(req.dataSource, {
                    force: String(req.query.forceDelete).toLowerCase() === 'true',
                    removeData: String(req.query.removeData).toLowerCase() === 'true',
                })
                .then((result) => {
                    result.asResponse(res);
                })
                .catch((err) => Result.Error(err).asResponse(res))
                .finally(() => next());
        } else {
            Result.Failure(`unable to find data source`, 404).asResponse(res);
            next();
        }
    }

    private static reprocessDataSource(req: Request, res: Response, next: NextFunction) {
        if (req.dataSource) {
            dataSourceRepo
                .reprocess(req.dataSource.DataSourceRecord!.id!)
                .then((result) => {
                    result.asResponse(res);
                })
                .catch((err) => Result.Error(err).asResponse(res))
                .finally(() => next());
        } else {
            Result.Failure(`unable to find data source`, 404).asResponse(res);
            next();
        }
    }
}
