import {Application, NextFunction, Request, Response} from 'express';
import {authInContainer} from '../../../middleware';
import NodeRepository from '../../../../data_access_layer/repositories/data_warehouse/data/node_repository';
import Result from '../../../../common_classes/result';
import {plainToClass, plainToInstance} from 'class-transformer';
import Node, {NodeIDPayload} from '../../../../domain_objects/data_warehouse/data/node';
import EdgeRepository from '../../../../data_access_layer/repositories/data_warehouse/data/edge_repository';
import Edge from '../../../../domain_objects/data_warehouse/data/edge';
import NodeLeafRepository from '../../../../data_access_layer/repositories/data_warehouse/data/node_leaf_repository';
import GraphQLRunner from '../../../../graphql/schema';
import {graphql} from 'graphql';
import {stringToValidPropertyName} from '../../../../services/utilities';
import NodeGraphQLSchemaGenerator from '../../../../graphql/node_graph_schema';
import DataSourceGraphQLSchemaGenerator from '../../../../graphql/timeseries_schema';

const nodeRepo = new NodeRepository();
const edgeRepo = new EdgeRepository();

export default class GraphRoutes {
    public static mount(app: Application, middleware: any[]) {
        app.post('/containers/:containerID/graphs/nodes/', ...middleware, authInContainer('write', 'data'), this.createOrUpdateNodes);
        app.get('/containers/:containerID/graphs/nodes/metatype/:metatypeID', ...middleware, authInContainer('read', 'data'), this.listNodesByMetatypeID);
        app.get('/containers/:containerID/graphs/nodes/', ...middleware, authInContainer('read', 'data'), this.listNodes);
        app.get('/containers/:containerID/graphs/nodes/:nodeID', ...middleware, authInContainer('read', 'data'), this.retrieveNode);

        // This should return all edges which contain one of the ids in the payload
        app.post('/containers/:containerID/graphs/nodes/edges', ...middleware, authInContainer('read', 'data'), this.retrieveEdges);

        // This should return a node and all connected nodes and connecting edges for n layers.
        app.get('/containers/:containerID/graphs/nodes/:nodeID/graph', ...middleware, authInContainer('read', 'data'), this.retrieveNthNodes);

        app.post('/containers/:containerID/graphs/nodes/:nodeID/timeseries', ...middleware, authInContainer('read', 'data'), this.queryTimeseriesData);
        app.get('/containers/:containerID/graphs/nodes/:nodeID/timeseries', ...middleware, authInContainer('read', 'data'), this.queryTimeseriesDataTypes);

        app.post(
            '/containers/:containerID/import/datasources/:dataSourceID/data',
            ...middleware,
            authInContainer('read', 'data'),
            this.queryTimeseriesDataSource,
        );

        app.get('/containers/:containerID/graphs/nodes/:nodeID/files', ...middleware, authInContainer('read', 'data'), this.listFilesForNode);
        app.put('/containers/:containerID/graphs/nodes/:nodeID/files/:fileID', ...middleware, authInContainer('write', 'data'), this.attachFileToNode);
        app.delete('/containers/:containerID/graphs/nodes/:nodeID/files/:fileID', ...middleware, authInContainer('write', 'data'), this.detachFileFromNode);

        app.post('/containers/:containerID/graphs/edges/', ...middleware, authInContainer('write', 'data'), this.createOrUpdateEdges);
        app.get('/containers/:containerID/graphs/edges/:edgeID', ...middleware, authInContainer('read', 'data'), this.retrieveEdge);
        app.get('/containers/:containerID/graphs/edges/', ...middleware, authInContainer('read', 'data'), this.listEdges);

        app.get('/containers/:containerID/graphs/edges/:edgeID/files', ...middleware, authInContainer('read', 'data'), this.listFilesForEdge);
        app.put('/containers/:containerID/graphs/edges/:edgeID/files/:fileID', ...middleware, authInContainer('write', 'data'), this.attachFileToEdge);
        app.delete('/containers/:containerID/graphs/edges/:edgeID/files/:fileID', ...middleware, authInContainer('write', 'data'), this.detachFileFromEdge);

        app.delete('/containers/:containerID/graphs/nodes/:nodeID', ...middleware, authInContainer('write', 'data'), this.deleteNode);
        app.delete('/containers/:containerID/graphs/edges/:edgeID', ...middleware, authInContainer('write', 'data'), this.archiveEdge);
    }
    private static listNodes(req: Request, res: Response, next: NextFunction) {
        // fresh instance of the repo to avoid filter issues
        if (req.container) {
            let repo = new NodeRepository();
            repo = repo.where().containerID('eq', req.container.id!);

            if (typeof req.query.transformationID !== 'undefined' && (req.query.transformationID as string) !== '') {
                repo = repo.and().transformationID('eq', req.query.transformationID);
            }

            if (typeof req.query.metatypeID !== 'undefined' && (req.query.metatypeID as string) !== '') {
                repo = repo.and().metatypeID('eq', req.query.metatypeID);
            }

            if (typeof req.query.dataSourceID !== 'undefined' && (req.query.dataSourceID as string) !== '') {
                repo = repo.and().dataSourceID('eq', req.query.dataSourceID);
            }

            if (req.query.count !== undefined && String(req.query.count).toLowerCase() === 'true') {
                repo.count(undefined, {
                    limit: req.query.limit ? +req.query.limit : undefined,
                    offset: req.query.offset ? +req.query.offset : undefined,
                })
                    .then((result) => {
                        result.asResponse(res);
                    })
                    .catch((err) => {
                        Result.Failure(err, 404).asResponse(res);
                    })
                    .finally(() => next());
            } else {
                repo.list(String(req.query.loadMetatypes).toLowerCase() === 'true', {
                    limit: req.query.limit ? +req.query.limit : undefined,
                    offset: req.query.offset ? +req.query.offset : undefined,
                })
                    .then((result) => {
                        if (result.isError && result.error) {
                            result.asResponse(res);
                            return;
                        }
                        res.status(200).json(result);
                    })
                    .catch((err) => Result.Failure(err, 404).asResponse(res))
                    .finally(() => next());
            }
        } else {
            Result.Failure(`container not found`, 404).asResponse(res);
            next();
        }
    }

    private static retrieveNode(req: Request, res: Response, next: NextFunction) {
        if (req.node) {
            Result.Success(req.node).asResponse(res);
            next();
        } else {
            Result.Failure(`node not found`, 404).asResponse(res);
            next();
        }
    }

    private static retrieveEdges(req: Request, res: Response, next: NextFunction) {
        // fresh instance of the repo to avoid filter issues
        if (req.container) {
            const payload = plainToInstance(NodeIDPayload, req.body as object);

            let repo = new EdgeRepository();
            repo = repo
                .where()
                .containerID('eq', req.container.id!)
                .and()
                .origin_node_id('in', payload.node_ids)
                .or()
                .containerID('eq', req.container.id!)
                .and()
                .destination_node_id('in', payload.node_ids);

            if (req.query.count !== undefined && String(req.query.count).toLowerCase() === 'true') {
                repo.count(undefined, {
                    limit: req.query.limit ? +req.query.limit : undefined,
                    offset: req.query.offset ? +req.query.offset : undefined,
                })
                    .then((result) => {
                        result.asResponse(res);
                    })
                    .catch((err) => {
                        Result.Failure(err, 404).asResponse(res);
                    })
                    .finally(() => next());
            } else {
                repo.list(String(req.query.loadMetatypeRelationshipss).toLowerCase() === 'true', {
                    limit: req.query.limit ? +req.query.limit : undefined,
                    offset: req.query.offset ? +req.query.offset : undefined,
                })
                    .then((result) => {
                        if (result.isError && result.error) {
                            result.asResponse(res);
                            return;
                        }
                        res.status(200).json(result);
                    })
                    .catch((err) => Result.Failure(err, 404).asResponse(res))
                    .finally(() => next());
            }
        } else {
            Result.Failure(`container not found`, 404).asResponse(res);
            next();
        }
    }

    // This should return a node and all connected nodes and connecting edges for n layers.
    private static retrieveNthNodes(req: Request, res: Response, next: NextFunction) {
        if (req.node) {
            let depth: any = '10';
            if (typeof req.query.depth !== 'undefined' && (req.query.depth as string) !== '') {
                depth = req.query.depth;
            }
            const repo = new NodeLeafRepository(req.node.id!, req.node.container_id!, depth);
            repo.list({sortBy: 'depth'})
                .then((result) => {
                    result.asResponse(res);
                })
                .catch((err) => {
                    Result.Error(err).asResponse(res);
                })
                .finally(() => next());
        } else {
            Result.Failure(`graph not found`, 404).asResponse(res);
            next();
        }
    }

    private static retrieveEdge(req: Request, res: Response, next: NextFunction) {
        if (req.edge) {
            Result.Success(req.edge).asResponse(res);
            next();
        } else {
            Result.Failure(`edge not found`, 404).asResponse(res);
            next();
        }
    }

    private static listNodesByMetatypeID(req: Request, res: Response, next: NextFunction) {
        // fresh instance of the repo to avoid filter issues
        if (req.container && req.metatype) {
            const repo = new NodeRepository();
            repo.where()
                .containerID('eq', req.container.id!)
                .and()
                .metatypeID('eq', req.metatype.id)
                .and()
                .list(String(req.query.loadMetatypes).toLowerCase() === 'true', {
                    limit: req.query.limit ? +req.query.limit : undefined,
                    offset: req.query.offset ? +req.query.offset : undefined,
                })
                .then((result) => {
                    if (result.isError && result.error) {
                        result.asResponse(res);
                        return;
                    }
                    res.status(200).json(result);
                })
                .catch((err) => Result.Failure(err, 404).asResponse(res))
                .finally(() => next());
        } else {
            Result.Failure(`container or metatype not found`, 404).asResponse(res);
            next();
        }
    }

    private static listEdges(req: Request, res: Response, next: NextFunction) {
        // new repository so we don't pollute the main one
        let repository = new EdgeRepository();
        repository = repository.where().containerID('eq', req.params.containerID);

        if (typeof req.query.originID !== 'undefined' && (req.query.originID as string) !== '') {
            repository = repository.and().origin_node_id('eq', req.query.originID);
        }

        if (typeof req.query.destinationID !== 'undefined' && (req.query.destinationID as string) !== '') {
            repository = repository.and().destination_node_id('eq', req.query.destinationID);
        }

        if (typeof req.query.relationshipPairID !== 'undefined' && (req.query.relationshipPairID as string) !== '') {
            repository = repository.and().relationshipPairID('eq', req.query.relationshipPairID);
        }

        if (typeof req.query.relationshipPairName !== 'undefined' && (req.query.relationshipPairName as string) !== '') {
            repository = repository.and().relationshipName('eq', req.query.relationshipPairName);
        }

        if (typeof req.query.dataSourceID !== 'undefined' && (req.query.dataSourceID as string) !== '') {
            repository = repository.and().dataSourceID('eq', req.query.dataSourceID);
        }

        if (req.query.count !== undefined && String(req.query.count).toLowerCase() === 'true') {
            repository
                .count(undefined, {
                    limit: req.query.limit ? +req.query.limit : undefined,
                    offset: req.query.offset ? +req.query.offset : undefined,
                })
                .then((result) => {
                    if (result.isError && result.error) {
                        result.asResponse(res);
                        return;
                    }
                    res.status(200).json(result);
                })
                .catch((err) => {
                    Result.Failure(err, 404).asResponse(res);
                })
                .finally(() => next());
        } else {
            repository
                .list(req.query.loadRelationshipPairs !== undefined && req.query.loadRelationshipPairs === 'true', {
                    limit: req.query.limit ? +req.query.limit : undefined,
                    offset: req.query.offset ? +req.query.offset : undefined,
                })
                .then((result) => {
                    if (result.isError && result.error) {
                        result.asResponse(res);
                        return;
                    }
                    res.status(200).json(result);
                })
                .catch((err) => Result.Failure(err, 404).asResponse(res))
                .finally(() => next());
        }
    }

    private static createOrUpdateNodes(req: Request, res: Response, next: NextFunction) {
        let toSave: Node[] = [];

        if (Array.isArray(req.body)) {
            toSave = plainToInstance(Node, req.body);
        } else {
            toSave = [plainToInstance(Node, req.body as object)];
        }

        // update with containerID and current active graph if none specified
        if (req.container) {
            toSave.forEach((node) => {
                node.container_id = req.container!.id!;
            });
        }

        nodeRepo
            .bulkSave(req.currentUser!, toSave)
            .then((result) => {
                if (result.isError) {
                    Result.Error(result.error?.error).asResponse(res);
                    return;
                }

                Result.Success(toSave).asResponse(res);
            })
            .catch((err) => {
                Result.Error(err).asResponse(res);
            })
            .finally(() => next());
    }

    private static createOrUpdateEdges(req: Request, res: Response, next: NextFunction) {
        let toSave: Edge[] = [];

        if (Array.isArray(req.body)) {
            toSave = plainToClass(Edge, req.body);
        } else {
            toSave = [plainToClass(Edge, req.body as object)];
        }

        // update with containerID and current active graph if none specified
        if (req.container) {
            toSave.forEach((edge) => {
                edge.container_id = req.container!.id!;
            });
        }

        edgeRepo
            .bulkSave(req.currentUser!, toSave)
            .then((result) => {
                if (result.isError) {
                    Result.Error(result.error?.error).asResponse(res);
                    return;
                }

                Result.Success(toSave).asResponse(res);
            })
            .catch((err) => {
                Result.Error(err).asResponse(res);
            })
            .finally(() => next());
    }

    private static archiveEdge(req: Request, res: Response, next: NextFunction) {
        if (req.edge) {
            edgeRepo
                .delete(req.edge)
                .then((result) => {
                    result.asResponse(res);
                })
                .catch((err) => {
                    Result.Error(err).asResponse(res);
                })
                .finally(() => next());
        } else {
            Result.Failure('edge not found', 404).asResponse(res);
            next();
        }
    }

    private static deleteNode(req: Request, res: Response, next: NextFunction) {
        if (req.node) {
            nodeRepo
                .delete(req.node)
                .then((result) => {
                    result.asResponse(res);
                })
                .catch((err) => {
                    Result.Error(err).asResponse(res);
                })
                .finally(() => next());
        } else {
            Result.Failure('node not found', 404).asResponse(res);
            next();
        }
    }

    private static listFilesForNode(req: Request, res: Response, next: NextFunction) {
        if (req.node) {
            nodeRepo
                .listFiles(req.node)
                .then((result) => {
                    result.asResponse(res);
                })
                .catch((err) => {
                    Result.Error(err).asResponse(res);
                })
                .finally(() => next());
        } else {
            Result.Failure(`node not found`, 404).asResponse(res);
            next();
        }
    }

    private static attachFileToNode(req: Request, res: Response, next: NextFunction) {
        if (req.node && req.file) {
            nodeRepo
                .addFile(req.node, req.file.id!)
                .then((result) => {
                    result.asResponse(res);
                })
                .catch((err) => {
                    Result.Error(err).asResponse(res);
                })
                .finally(() => next());
        } else {
            Result.Failure(`node or file not found`, 404).asResponse(res);
            next();
        }
    }

    private static detachFileFromNode(req: Request, res: Response, next: NextFunction) {
        if (req.node && req.file) {
            nodeRepo
                .removeFile(req.node, req.file.id!)
                .then((result) => {
                    result.asResponse(res);
                })
                .catch((err) => {
                    Result.Error(err).asResponse(res);
                })
                .finally(() => next());
        } else {
            Result.Failure(`node or file not found`, 404).asResponse(res);
            next();
        }
    }

    private static listFilesForEdge(req: Request, res: Response, next: NextFunction) {
        if (req.edge) {
            edgeRepo
                .listFiles(req.edge)
                .then((result) => {
                    result.asResponse(res);
                })
                .catch((err) => {
                    Result.Error(err).asResponse(res);
                })
                .finally(() => next());
        } else {
            Result.Failure(`edge not found`, 404).asResponse(res);
            next();
        }
    }

    private static attachFileToEdge(req: Request, res: Response, next: NextFunction) {
        if (req.edge && req.file) {
            edgeRepo
                .addFile(req.edge, req.file.id!)
                .then((result) => {
                    result.asResponse(res);
                })
                .catch((err) => {
                    Result.Error(err).asResponse(res);
                })
                .finally(() => next());
        } else {
            Result.Failure(`edge or file not found`, 404).asResponse(res);
            next();
        }
    }

    private static detachFileFromEdge(req: Request, res: Response, next: NextFunction) {
        if (req.edge && req.file) {
            edgeRepo
                .removeFile(req.edge, req.file.id!)
                .then((result) => {
                    result.asResponse(res);
                })
                .catch((err) => {
                    Result.Error(err).asResponse(res);
                })
                .finally(() => next());
        } else {
            Result.Failure(`edge or file not found`, 404).asResponse(res);
            next();
        }
    }

    private static queryTimeseriesData(req: Request, res: Response, next: NextFunction) {
        const generator = new NodeGraphQLSchemaGenerator();

        generator
            .ForNode(req.container?.id!, req.node?.id!, {
                returnFile: String(req.query.returnFile).toLowerCase() === 'true',
                returnFileType: String(req.query.returnFileType).toLowerCase(),
            })
            .then((schemaResult) => {
                if (schemaResult.isError) {
                    Result.Error(schemaResult.error).asResponse(res);
                    return;
                }

                graphql({
                    schema: schemaResult.value,
                    source: req.body.query,
                    variableValues: req.body.variables,
                })
                    .then((response) => {
                        res.status(200).json(response);
                    })
                    .catch((e) => {
                        res.status(500).json(e.toString());
                    });
            })
            .catch((e) => {
                res.status(500).json(e.toString());
            });
    }

    private static queryTimeseriesDataTypes(req: Request, res: Response, next: NextFunction) {
        const repo = new NodeRepository();

        repo.listTimeseriesTables(req.node!, req.container?.id!)
            .then((results) => {
                results.asResponse(res);
            })
            .catch((e) => Result.Error(e).asResponse(res));
    }

    private static queryTimeseriesDataSource(req: Request, res: Response, next: NextFunction) {
        const generator = new DataSourceGraphQLSchemaGenerator();

        generator
            .ForDataSource(req.params.dataSourceID, {
                returnFile: String(req.query.returnFile).toLowerCase() === 'true',
                returnFileType: String(req.query.returnFileType).toLowerCase(),
            })
            .then((schemaResult) => {
                if (schemaResult.isError) {
                    Result.Error(schemaResult.error).asResponse(res);
                    return;
                }

                graphql({
                    schema: schemaResult.value,
                    source: req.body.query,
                    variableValues: req.body.variables,
                })
                    .then((response) => {
                        res.status(200).json(response);
                    })
                    .catch((e) => {
                        Result.Error(e).asResponse(res);
                    });
            })
            .catch((e) => {
                Result.Error(e).asResponse(res);
            });
    }
}
