import {User} from '../../../domain_objects/access_management/user';
import Logger from '../../../services/logger';
import PostgresAdapter from '../../../data_access_layer/mappers/db_adapters/postgres/postgres';
import ContainerStorage from '../../../data_access_layer/mappers/data_warehouse/ontology/container_mapper';
import Container from '../../../domain_objects/data_warehouse/ontology/container';
import faker from 'faker';
import {expect} from 'chai';
import UserMapper from '../../../data_access_layer/mappers/access_management/user_mapper';
import ContainerMapper from '../../../data_access_layer/mappers/data_warehouse/ontology/container_mapper';
import DataSourceMapper from '../../../data_access_layer/mappers/data_warehouse/import/data_source_mapper';
import DataSourceRecord, {TimeseriesColumn, TimeseriesDataSourceConfig} from '../../../domain_objects/data_warehouse/import/data_source';
import DataSourceRepository, {DataSourceFactory} from '../../../data_access_layer/repositories/data_warehouse/import/data_source_repository';
import StandardDataSourceImpl from '../../../interfaces_and_impl/data_warehouse/import/standard_data_source_impl';
import HttpDataSourceImpl from '../../../interfaces_and_impl/data_warehouse/import/http_data_source_impl';
import AvevaDataSourceImpl from '../../../interfaces_and_impl/data_warehouse/import/aveva_data_source';
import JazzDataSourceImpl from '../../../interfaces_and_impl/data_warehouse/import/jazz_data_source_impl';
import fs from 'fs';
import DataStagingRepository from '../../../data_access_layer/repositories/data_warehouse/import/data_staging_repository';
import {toStream} from '../../../services/utilities';
import Import, {DataStaging} from '../../../domain_objects/data_warehouse/import/import';
import TimeseriesDataSourceImpl from '../../../interfaces_and_impl/data_warehouse/import/timeseries_data_source';
import {plainToClass, plainToInstance} from 'class-transformer';

const csv = require('csvtojson');

// Generally testing the standard implementation to verify that the ReceiveData and other underlying functions that most
// other implementations rely on function ok.
describe('A Standard DataSource Implementation can', async () => {
    let containerID: string = process.env.TEST_CONTAINER_ID || '';
    let user: User;

    before(async function () {
        if (process.env.CORE_DB_CONNECTION_STRING === '') {
            Logger.debug('skipping export tests, no storage layer');
            this.skip();
        }

        await PostgresAdapter.Instance.init();
        const mapper = ContainerStorage.Instance;

        const container = await mapper.Create(
            'test suite',
            new Container({
                name: faker.name.findName(),
                description: faker.random.alphaNumeric(),
            }),
        );

        expect(container.isError).false;
        expect(container.value.id).not.null;
        containerID = container.value.id!;

        const userResult = await UserMapper.Instance.Create(
            'test suite',
            new User({
                identity_provider_id: faker.random.uuid(),
                identity_provider: 'username_password',
                admin: false,
                display_name: faker.name.findName(),
                email: faker.internet.email(),
                roles: ['superuser'],
            }),
        );

        expect(userResult.isError).false;
        expect(userResult.value).not.empty;
        user = userResult.value;

        return Promise.resolve();
    });

    after(async () => {
        await UserMapper.Instance.Delete(user.id!);
        return ContainerMapper.Instance.Delete(containerID);
    });

    it('can create a new timeseries data source, building proper table and tearing down', async () => {
        // build the data source first
        const sourceRepo = new DataSourceRepository();

        let source = new DataSourceFactory().fromDataSourceRecord(
            new DataSourceRecord({
                container_id: containerID,
                name: 'Test Data Source',
                active: false,
                adapter_type: 'timeseries',
                config: new TimeseriesDataSourceConfig({
                    columns: [
                        {
                            column_name: 'primary_timestamp',
                            property_name: 'timestamp',
                            is_primary_timestamp: true,
                            type: 'date',
                        },
                        {
                            column_name: 'temperature',
                            property_name: 'Temperature (K)',
                            is_primary_timestamp: false,
                            type: 'number',
                        },
                    ] as TimeseriesColumn[],
                }),
            }),
        );

        let results = await sourceRepo.save(source!, user);
        expect(results.isError, results.error?.error).false;
        expect(source!.DataSourceRecord?.id).not.undefined;

        results = await sourceRepo.delete(source!);
        expect(results.isError, results.error?.error).false;

        // now we try with a unique index
        source = new DataSourceFactory().fromDataSourceRecord(
            new DataSourceRecord({
                container_id: containerID,
                name: 'Test Data Source',
                active: false,
                adapter_type: 'timeseries',
                config: new TimeseriesDataSourceConfig({
                    columns: [
                        {
                            column_name: 'primary_timestamp',
                            property_name: 'timestamp',
                            is_primary_timestamp: true,
                            type: 'date',
                        },
                        {
                            column_name: 'temperature',
                            property_name: 'Temperature (K)',
                            is_primary_timestamp: false,
                            unique: true,
                            type: 'number',
                        },
                    ] as TimeseriesColumn[],
                }),
            }),
        );

        results = await sourceRepo.save(source!, user);
        expect(results.isError).false;
        expect(source!.DataSourceRecord?.id).not.undefined;

        results = await sourceRepo.delete(source!);
        expect(results.isError).false;

        // now we try with a bigint ID,fails at first because no chunk interval
        source = new DataSourceFactory().fromDataSourceRecord(
            new DataSourceRecord({
                container_id: containerID,
                name: 'Test Data Source',
                active: false,
                adapter_type: 'timeseries',
                config: new TimeseriesDataSourceConfig({
                    columns: [
                        {
                            column_name: 'primary_timestamp',
                            property_name: 'timestamp',
                            is_primary_timestamp: true,
                            type: 'number',
                        },
                        {
                            column_name: 'temperature',
                            property_name: 'Temperature (K)',
                            is_primary_timestamp: false,
                            unique: false,
                            type: 'number',
                        },
                    ] as TimeseriesColumn[],
                }),
            }),
        );

        results = await sourceRepo.save(source!, user);
        expect(results.isError).true;

        // now we try with a bigint ID
        source = new DataSourceFactory().fromDataSourceRecord(
            new DataSourceRecord({
                container_id: containerID,
                name: 'Test Data Source',
                active: false,
                adapter_type: 'timeseries',
                config: new TimeseriesDataSourceConfig({
                    columns: [
                        {
                            column_name: 'primary_timestamp',
                            property_name: 'timestamp',
                            is_primary_timestamp: true,
                            type: 'number',
                        },
                        {
                            column_name: 'temperature',
                            property_name: 'Temperature (K)',
                            is_primary_timestamp: false,
                            unique: false,
                            type: 'number',
                        },
                    ] as TimeseriesColumn[],
                    chunk_interval: '1000',
                }),
            }),
        );

        results = await sourceRepo.save(source!, user);
        expect(results.isError, results.error?.error).false;
        expect(source!.DataSourceRecord?.id).not.undefined;

        results = await sourceRepo.delete(source!);
        expect(results.isError).false;

        return Promise.resolve();
    });

    it('fails on creation if primary timestamp is missing or invalid', async () => {
        // build the data source first
        const sourceRepo = new DataSourceRepository();

        let source = new DataSourceFactory().fromDataSourceRecord(
            new DataSourceRecord({
                container_id: containerID,
                name: 'Test Data Source',
                active: false,
                adapter_type: 'timeseries',
                config: new TimeseriesDataSourceConfig({
                    columns: plainToInstance(TimeseriesColumn, [
                        {
                            column_name: 'temperature',
                            property_name: 'Temperature (K)',
                            is_primary_timestamp: false,
                            type: 'number',
                        },
                    ]),
                }),
            }),
        );

        let results = await sourceRepo.save(source!, user);
        expect(results.isError).true;

        source = new DataSourceFactory().fromDataSourceRecord(
            new DataSourceRecord({
                container_id: containerID,
                name: 'Test Data Source',
                active: false,
                adapter_type: 'timeseries',
                config: new TimeseriesDataSourceConfig({
                    columns: plainToInstance(TimeseriesColumn, [
                        {
                            column_name: 'primary_timestamp',
                            property_name: 'timestamp',
                            is_primary_timestamp: true,
                            type: 'string',
                        },
                        {
                            column_name: 'temperature',
                            property_name: 'Temperature (K)',
                            is_primary_timestamp: false,
                            type: 'number',
                        },
                    ]),
                }),
            }),
        );

        results = await sourceRepo.save(source!, user);
        expect(results.isError).true;

        source = new DataSourceFactory().fromDataSourceRecord(
            new DataSourceRecord({
                container_id: containerID,
                name: 'Test Data Source',
                active: false,
                adapter_type: 'timeseries',
                config: new TimeseriesDataSourceConfig({
                    columns: plainToInstance(TimeseriesColumn, [
                        {
                            column_name: 'primary_timestamp',
                            property_name: 'timestamp',
                            is_primary_timestamp: true,
                            type: 'number',
                        },
                        {
                            column_name: 'primary_timestamp2',
                            property_name: 'timestamp',
                            is_primary_timestamp: true,
                            type: 'number',
                        },
                        {
                            column_name: 'temperature',
                            property_name: 'Temperature (K)',
                            is_primary_timestamp: false,
                            type: 'number',
                        },
                    ]),
                }),
            }),
        );

        results = await sourceRepo.save(source!, user);
        expect(results.isError).true;

        return Promise.resolve();
    });

    it('can ingest data to a hypertable', async () => {
        // build the data source first
        const sourceRepo = new DataSourceRepository();

        let source = new DataSourceFactory().fromDataSourceRecord(
            new DataSourceRecord({
                container_id: containerID,
                name: 'Test Data Source',
                active: false,
                adapter_type: 'timeseries',
                config: new TimeseriesDataSourceConfig({
                    columns: [
                        {
                            column_name: 'primary_timestamp',
                            property_name: 'Timestamp',
                            is_primary_timestamp: true,
                            type: 'date',
                            date_conversion_format_string: 'YYYY-MM-DD HH:MI:SS',
                        },
                        {
                            column_name: 'temperature',
                            property_name: 'Temperature (K)',
                            is_primary_timestamp: false,
                            type: 'number',
                        },
                        {
                            column_name: 'velocity_i',
                            property_name: 'Velocity[i] (m/s)',
                            is_primary_timestamp: false,
                            type: 'number',
                        },
                        {
                            column_name: 'velocity_j',
                            property_name: 'Velocity[j] (m/s)',
                            is_primary_timestamp: false,
                            type: 'number',
                        },
                        {
                            column_name: 'x',
                            property_name: 'X (m)',
                            is_primary_timestamp: false,
                            type: 'number',
                        },
                        {
                            column_name: 'y',
                            property_name: 'Y (m)',
                            is_primary_timestamp: false,
                            type: 'number',
                        },
                        {
                            column_name: 'z',
                            property_name: 'Z (m)',
                            is_primary_timestamp: false,
                            type: 'number',
                        },
                    ] as TimeseriesColumn[],
                }),
            }),
        );

        let results = await sourceRepo.save(source!, user);
        expect(results.isError, results.error?.error).false;
        expect(source!.DataSourceRecord?.id).not.undefined;

        // write the json test data out to a temporary file
        fs.writeFileSync('./test-timeseries-data.json', sampleJSON);

        // now we create an import through the datasource
        let received = await source!.ReceiveData(fs.createReadStream('./test-timeseries-data.json'), user);
        expect(received.isError, received.error?.error).false;

        // now let's try csv files
        fs.writeFileSync('./test-timeseries-data.csv', sampleCSV);

        received = await source!.ReceiveData(fs.createReadStream('./test-timeseries-data.csv'), user, {
            transformStreams: [
                csv({
                    downstreamFormat: 'array', // needed because downstream expects an array of json, not single objects
                }),
            ],
        });
        expect(received.isError, received.error?.error).false;

        fs.unlinkSync('./test-timeseries-data.csv');
        fs.unlinkSync('./test-timeseries-data.json');
        return sourceRepo.delete(source!);
    });
});

const sampleCSV =
    'Timestamp,Temperature (K),Velocity[i] (m/s),Velocity[j] (m/s),X (m),Y (m),Z (m)\n' +
    '2022-07-18 02:32:27.877058,230,,,2,7,0\n' +
    '2022-07-18 02:32:27.877059,236,,,4,2,0\n' +
    '2022-07-18 02:32:27.817059,271,,,8,4,0\n' +
    '2022-07-18 02:32:27.812059,280,,,3,2,0\n' +
    '2022-07-18 02:32:27.312059,299,,,8,8,0\n' +
    '2022-07-18 02:32:27.412059,344,,,7,9,0\n' +
    '2022-07-18 02:32:27.612059,245,,,6,0,0\n' +
    '2022-07-18 02:32:27.512059,260,,,1,6,0\n' +
    '2022-07-18 02:32:27.522059,291,,,0,1,0\n' +
    '2022-07-18 02:32:27.532059,235,,,5,3,0\n';

const sampleJSON = JSON.stringify([
    {
        Timestamp: '2022-07-18 02:32:27.877058',
        'Temperature (K)': 230,
        'Velocity[i] (m/s)': null,
        'Velocity[j] (m/s)': null,
        'X (m)': 2,
        'Y (m)': 7,
        'Z (m)': 0,
    },
    {
        Timestamp: '2022-07-18 02:32:27.877059',
        'Temperature (K)': 236,
        'Velocity[i] (m/s)': null,
        'Velocity[j] (m/s)': null,
        'X (m)': 4,
        'Y (m)': 2,
        'Z (m)': 0,
    },
    {
        Timestamp: '2022-07-18 02:32:27.817059',
        'Temperature (K)': 271,
        'Velocity[i] (m/s)': null,
        'Velocity[j] (m/s)': null,
        'X (m)': 8,
        'Y (m)': 4,
        'Z (m)': 0,
    },
    {
        Timestamp: '2022-07-18 02:32:27.812059',
        'Temperature (K)': 280,
        'Velocity[i] (m/s)': null,
        'Velocity[j] (m/s)': null,
        'X (m)': 3,
        'Y (m)': 2,
        'Z (m)': 0,
    },
    {
        Timestamp: '2022-07-18 02:32:27.312059',
        'Temperature (K)': 299,
        'Velocity[i] (m/s)': null,
        'Velocity[j] (m/s)': null,
        'X (m)': 8,
        'Y (m)': 8,
        'Z (m)': 0,
    },
    {
        Timestamp: '2022-07-18 02:32:27.412059',
        'Temperature (K)': 344,
        'Velocity[i] (m/s)': null,
        'Velocity[j] (m/s)': null,
        'X (m)': 7,
        'Y (m)': 9,
        'Z (m)': 0,
    },
    {
        Timestamp: '2022-07-18 02:32:27.612059',
        'Temperature (K)': 245,
        'Velocity[i] (m/s)': null,
        'Velocity[j] (m/s)': null,
        'X (m)': 6,
        'Y (m)': 0,
        'Z (m)': 0,
    },
    {
        Timestamp: '2022-07-18 02:32:27.512059',
        'Temperature (K)': 260,
        'Velocity[i] (m/s)': null,
        'Velocity[j] (m/s)': null,
        'X (m)': 1,
        'Y (m)': 6,
        'Z (m)': 0,
    },
    {
        Timestamp: '2022-07-18 02:32:27.522059',
        'Temperature (K)': 291,
        'Velocity[i] (m/s)': null,
        'Velocity[j] (m/s)': null,
        'X (m)': 0,
        'Y (m)': 1,
        'Z (m)': 0,
    },
    {
        Timestamp: '2022-07-18 02:32:27.532059',
        'Temperature (K)': 235,
        'Velocity[i] (m/s)': null,
        'Velocity[j] (m/s)': null,
        'X (m)': 5,
        'Y (m)': 3,
        'Z (m)': 0,
    },
]);

const sampleObject = {
    Timestamp: '2022-07-18 02:32:27.532059',
    'Temperature (K)': 235,
    'Velocity[i] (m/s)': null,
    'Velocity[j] (m/s)': null,
    'X (m)': 5,
    'Y (m)': 3,
    'Z (m)': 0,
};
