export type ContainerT = {
    id: string;
    name: string;
    description: string;
    config: {
        data_versioning_enabled: boolean;
        ontology_versioning_enabled: boolean;
        enabled_data_sources: string[];
    };
    created_at: string;
    modified_at: string;
    created_by: string;
    modified_by: string;
};

export type ContainerAlertT = {
    id: string;
    container_id: string;
    type: string;
    message: string;
    created_at: string;
    created_by: string;
};

export type MetatypeT = {
    id?: string;
    container_id: string;
    name: string;
    description: string;
    keys: MetatypeKeyT[];
    created_at?: string;
    modified_at?: string;
    created_by?: string;
    modified_by?: string;
    deleted_at?: string;
    parent_id?: string;
    ontology_version?: string;
    old_id?: string;
    uuid?: string;
};

export type MetatypeRelationshipT = {
    id?: string;
    container_id: string;
    name: string;
    description: string;
    keys: MetatypeRelationshipKeyT[];
    created_at?: string;
    modified_at?: string;
    created_by?: string;
    modified_by?: string;
    parent_id?: string;
    ontology_version?: string;
    old_id?: string;
};

export type MetatypeRelationshipPairT = {
    id?: string;
    container_id: string;
    name: string;
    description: string;
    origin_metatype_id?: string;
    origin_metatype_name: string;
    destination_metatype_id?: string;
    destination_metatype_name: string;
    relationship_id?: string;
    relationship_type: 'many:many' | 'one:one' | 'one:many' | 'many:one';
    relationship_name?: string;
    created_at?: string;
    modified_at?: string;
    created_by?: string;
    modified_by?: string;
    ontology_version?: string;
    old_id?: string;
    origin_metatype?: MetatypeT;
    destination_metatype?: MetatypeT;
    relationship?: MetatypeRelationshipT;
};

export type MetatypeKeyT = {
    id?: string;
    metatype_id?: string;
    container_id: string;
    name: string;
    property_name: string;
    required: boolean;
    description: string;
    data_type: 'number' | 'number64' | 'float' | 'float64' | 'date' | 'string' | 'boolean' | 'enumeration' | 'file';
    archived: boolean;
    validation:
        | {
              regex: string;
              min: number;
              max: number;
          }
        | undefined;
    options: string[] | undefined;
    default_value: string | boolean | number | any[] | undefined;
    created_at?: string;
    modified_at?: string;
    created_by?: string;
    modified_by?: string;
    deleted_at?: string;
    ontology_version?: string;
};

export type MetatypeRelationshipKeyT = {
    id?: string;
    metatype_relationship_id?: string;
    container_id: string;
    name: string;
    property_name: string;
    required: boolean;
    description: string;
    data_type: 'number' | 'number64' | 'float' | 'float64' | 'date' | 'string' | 'boolean' | 'enumeration' | 'file';
    archived: boolean;
    validation: {
        regex: string;
        min: number;
        max: number;
    };
    options: string[] | undefined;
    default_value: string | boolean | number | any[] | undefined;
    created_at?: string;
    modified_at?: string;
    created_by?: string;
    modified_by?: string;
    ontology_version?: string;
};

export type KeyPairT = {
    key: string;
    secret_raw: string;
    user_id: string;
    note: string;
};

export type FileT = {
    id: string;
    container_id: string;
    data_source_id: string;
    file_name: string;
    file_size: number;
    md5hash: string;
    adapter_file_path: string;
    adapter: 'filesystem' | 'azure_blob' | 'mock';
    metadata: object;
};

export type NodeT = {
    id: string;
    metatype_id: string;
    metatype_name: string;
    metatype: MetatypeT;
    properties: PropertyT[] | object;
    raw_properties: string; // JSON string with the raw properties
    container_id: string;
    original_data_id: string;
    data_source_id: string;
    created_at: string;
    modified_at: string;
    incoming_edges: EdgeT[];
    outgoing_edges: EdgeT[];
};

export type EdgeT = {
    id: string;
    container_id: string;
    data_source_id: string;
    relationship: MetatypeRelationshipT;
    destination_node?: NodeT;
    origin_node?: NodeT;
    origin_id?: string;
    destination_id?: string;
    metatype_relationship_name?: string;
    relationship_id?: string;
    properties: PropertyT[] | object;
    created_at: string;
    modified_at: string;
};

export type PropertyT = {
    key: string;
    value: string;
    type: string;
};

export type DataSourceT = {
    id?: string;
    container_id?: string;
    name: string;
    adapter_type: string | undefined;
    active: boolean;
    archived?: boolean;
    config: StandardDataSourceConfig | HttpDataSourceConfig | AvevaDataSourceConfig | JazzDataSourceConfig | TimeseriesDataSourceConfig | undefined;
    created_at?: string;
    modified_at?: string;
    created_by?: string;
    modified_by?: string;

    // composite fields, not on original return
    data_imported?: number;
};

export type StandardDataSourceConfig = {
    kind: 'standard' | 'manual';
    data_type: 'json' | 'csv';
    stop_nodes?: string[];
    value_nodes?: string[];
    data_retention_days?: number;
};

export type TimeseriesColumn = {
    id?: string;
    column_name?: string;
    property_name?: string;
    is_primary_timestamp: boolean;
    unique: boolean;
    type?: string;
    date_conversion_format_string?: string;
};

export type TimeseriesNodeParameter = {
    type?: string;
    operator?: string;
    key?: any;
    value?: any;
};

// we extend so the class-transformer can work properly, even though we don't actually need it
export type TimeseriesDataSourceConfig = {
    kind: 'timeseries';
    columns: TimeseriesColumn[];
    chunk_interval?: string; // only required if they are using a bigint as a primary timestamp
    attachment_parameters: TimeseriesNodeParameter[];
    stop_nodes?: string[];
    value_nodes?: string[];
    data_retention_days?: number;
};

export type HttpDataSourceConfig = {
    kind: 'http';
    endpoint: string;
    secure: boolean;
    auth_method: 'none' | 'basic' | 'token';
    poll_interval: number; // in minutes
    timeout: number; // milliseconds
    token?: string; // security token, set if auth method is token
    username?: string; // auth method basic
    password?: string; // auth method basic
    stop_nodes?: string[];
    value_nodes?: string[];
    data_retention_days?: number;
};

export type JazzDataSourceConfig = {
    kind: 'jazz';
    endpoint: string;
    secure: boolean;
    project_name: string;
    artifact_types: string[]; // artifact types to retrieve, everything else is ignored
    limit: number;
    poll_interval: number; // in minutes
    timeout: number; // milliseconds
    token: string; // security token for http authentication
    stop_nodes?: string[];
    value_nodes?: string[];
    data_retention_days?: number;
};

export type AvevaDataSourceConfig = {
    kind: 'aveva';
    ignore_dbs: string[];
    ignore_element_types: string[];
    ifc_element_types: string[];
    ifc_settings: {
        format: string;
        data_level: string;
        component_level: boolean;
        log_detail: number;
        arc_tolerance: string;
        tube: boolean;
        cl: boolean;
        insu_translucency: number;
        obst_translucency: number;
        root: number;
        pipe: number;
        nozzle: number;
        structure: number;
        cable: number;
    };
    stop_nodes?: string[];
    value_nodes?: string[];
    data_retention_days?: number;
};

export type ImportT = {
    id: string;
    data_source_id: string;
    status: string;
    status_message: string;
    created_at: string;
    modified_at: string;
    reference: string;
    created_by: string;
    modified_by: string;

    total_records: number;
    records_inserted: number;
};

export type AssignRolePayloadT = {
    user_id: string;
    container_id: string;
    role_name: string;
};

export type CreateServiceUserPayloadT = {
    display_name: string;
};

export type ServiceUserPermissionSetT = {
    containers: string[];
    ontology: string[];
    data: string[];
    users: string[];
};

export type ImportDataT = {
    id: number;
    data_source_id: string;
    import_id: string;
    mapping_id: string;
    errors: string[];
    data: {[key: string]: any};
    inserted_at: string;
    created_at: string;
};

export type TypeMappingT = {
    id: string;
    data_source_id: string;
    container_id: string;
    active: boolean;
    shape_hash: string;
    sample_payload: object;
    created_at: string;
    modified_at: string;
    transformations: TypeMappingTransformationT[];
};

export type TypeMappingTransformationKeyMapping = {
    id?: string;
    key: string;
    metatype_key_id?: string;
    metatype_relationship_key_id?: string;
    data_conversion_format_string?: string;
    column_name?: string;
    is_primary_timestamp?: boolean;
    value_type?: string;
};

export type TypeMappingTransformationSubexpression = {
    expression: 'AND' | 'OR';
    key: string;
    operator: string;
    value: any;
};

export type TypeMappingTransformationCondition = {
    key: string;
    operator: string;
    value: any;
    subexpressions: TypeMappingTransformationSubexpression[];
};

// Actions that can be performed when a transformation encounters an error
export type TransformationErrorAction = 'ignore' | 'fail on required' | 'fail';
export const TransformationErrorActions: TransformationErrorAction[] = ['ignore', 'fail on required', 'fail'];

export type TypeMappingTransformationConfiguration = {
    on_conversion_error: TransformationErrorAction;
    on_key_extraction_error: TransformationErrorAction;
};

export type TypeMappingTransformationT = {
    id: string;
    name: string;
    root_array: string;
    type_mapping_id: string;
    type: string;
    conditions?: TypeMappingTransformationCondition[];
    config: {
        on_conversion_error: string;
        on_key_extraction_error: string;
    };
    metatype_id?: string;
    metatype_relationship_pair_id?: string;
    origin_id_key?: string;
    origin_metatype_id?: string;
    origin_data_source_id?: string;
    destination_id_key?: string;
    destination_metatype_id?: string;
    destination_data_source_id?: string;
    tab_data_source_id?: string;
    tab_metatype_id?: string;
    tab_node_id?: string;
    tab_node_key?: string;
    unique_identifier_key?: string;
    on_conflict?: 'create' | 'update' | 'ignore';
    metatype_name?: string;
    metatype_ontology_version?: string;
    metatype_relationship_pair_name?: string;
    metatype_relationship_pair_ontology_version?: string;
    keys: TypeMappingTransformationKeyMapping[];
    archived: boolean;
};

export type TypeMappingTransformationPayloadT = {
    conditions?: TypeMappingTransformationCondition[];
    metatype_id?: string;
    metatype_relationship_pair_id?: string;
    origin_id_key?: string;
    origin_metatype_id?: string;
    origin_data_source_id?: string;
    destination_id_key?: string;
    destination_metatype_id?: string;
    destination_data_source_id?: string;
    unique_identifier_key?: string;
    on_conflict?: 'create' | 'update' | 'ignore';
    keys: TypeMappingTransformationKeyMapping[];
    type_mapping_id: string;
};

export type TypeMappingUpgradePayloadT = {
    mapping_ids: string[];
    ontology_version: string;
};

export type UserContainerInviteT = {
    id: number;
    email: string;
    origin_user: string;
    token: string;
    accepted: boolean;
    container_id: string;
    container_name: string;
    issued: string;
};

export type ExportT = {
    id: string;
    destination_type: string;
    adapter: 'gremlin';
    config: GremlinExportConfigT;
    container_id?: string;
    status?: 'created' | 'processing' | 'paused' | 'completed' | 'failed';
    status_message?: string;
};

export type GremlinExportConfigT = {
    kind: 'gremlin';
    traversal_source: string;
    user: string;
    key: string;
    endpoint: string;
    port: string; // port is a string due to the type expected by DL also being a string
    path: string;
    writes_per_second: number;
    mime_type?: string;
    graphson_v1?: boolean;
    created_at?: string;
    modified_at?: string;
    created_by?: string;
    modified_by?: string;
};

export type OntologyVersionT = {
    id?: string;
    container_id: string;
    name: string;
    description?: string;
    created_by?: string;
    created_at?: string;
    approved_at?: string;
    approved_by?: string;
    published_at?: string;
    status?: 'pending' | 'approved' | 'rejected' | 'published' | 'deprecated' | 'ready' | 'generating';
    status_message?: string;
};

export type ChangelistT = {
    id?: string;
    container_id: string;
    name: string;
    status?: 'pending' | 'ready' | 'approved' | 'rejected' | 'applied' | 'deprecated' | 'generating';
    changelist?: object;
    applied_at?: string;
    created_at?: string;
    modified_at?: string;
    created_by?: string;
    modified_by?: string;
};

export type ChangelistApprovalT = {
    id?: string;
    changelist_id: string;
    approved_by: string;
    approved_at?: string;
};

export type ResultT<T> = {
    value: T;
    isError: boolean;
    error: any;
};

// DefaultAvevaDataSourceConfig are sane defaults found through trial and error with the Aveva Deep Lynx Adapter
// while we could include this on the createDataSourceDialog component, it's so large that it clutters
// that component - better to pull it out and maintain it here so the connection to Deep Lynx is clear.
export function DefaultAvevaDataSourceConfig(): AvevaDataSourceConfig {
    return {
        kind: 'aveva',
        data_retention_days: 30,
        ignore_dbs: [
            'SYSTEM',
            'DICTIONARY',
            'PROPERTY',
            'CATALOG',
            'NSEQ',
            'COMMENT/COMMENT',
            'COMMENTENG/COMMENT',
            'PPROJECT/CONFIG',
            'PPROJECT/REFGRID',
            'ADMIN/REFDATA',
            'ASSOC/ASSOC',
            'SAMPLE/ENGITAGS',
            'SHARED/HMLINKS',
            'SHARED/DESIGN',
            'UNKNOWN',
        ],
        ignore_element_types: [
            'GENPRI',
            'POINT',
            'INVISIBLE POINT',
            'TANGENT POINT',
            'POLYGON',
            'VERTEX',
            'AIDARC',
            'AIDCIRCLE',
            'AIDLINE',
            'AIDPOINT',
            'AIDTEXT',
            'BOX',
            'CONE',
            'CTORUS',
            'CYLINDER',
            'DISH',
            'DRAWING',
            'EXTRUSION',
            'IPOINT',
            'LINDIMENSION',
            'LOOP',
            'LOOPTS',
            'MLABEL',
            'POGON',
            'POHEDRON',
            'POINT',
            'POLFACE',
            'POLOOP',
            'POLPTLIST',
            'POLYHEDRON',
            'PYRAMID',
            'REVOLUTION',
            'RTORUS',
            'SLCYLINDER',
            'SNOUT',
            'TANPOINT',
            'VERTEX',
            'NBOX',
            'NCONE',
            'NCTORUS',
            'NCYLINDER',
            'NDISH',
            'NPOLYHEDRON',
            'NPYRAMID',
            'NREVOLUTION',
            'NRTORUS',
            'NSLCYLINDER',
            'NSNOUT',
            'NXRUSION',
        ],
        ifc_element_types: ['WORLD', 'SITE', 'AREA WORLD', 'GROUP WORLD', 'GROUP', 'AREA SET', 'AREA DEFINITION', 'SITE', 'ZONE', 'DRAWING', 'STRUCTURE'],
        ifc_settings: {
            format: 'IFC2x3',
            data_level: 'GA',
            component_level: true,
            log_detail: 2,
            arc_tolerance: '10mm',
            tube: true,
            cl: false,
            insu_translucency: 25,
            obst_translucency: 50,
            root: 6,
            pipe: 6,
            nozzle: 6,
            structure: 6,
            cable: 6,
        },
    };
}

// Like the AvevaDefaultConfig we're including functions for all default configs for data source types, easier to
// change when they're in one place.
export function DefaultJazzDataSourceConfig(): JazzDataSourceConfig {
    return {
        kind: 'jazz',
        endpoint: '',
        secure: true,
        project_name: '',
        artifact_types: [],
        poll_interval: 10,
        token: '',
        timeout: 30000,
        limit: 10,
        data_retention_days: 30,
    };
}

export function DefaultHttpDataSourceConfig(): HttpDataSourceConfig {
    return {
        kind: 'http',
        endpoint: '',
        secure: true,
        auth_method: 'none',
        poll_interval: 10,
        timeout: 15000,
        data_retention_days: 30,
    };
}

export function DefaultStandardDataSourceConfig(): StandardDataSourceConfig {
    return {
        kind: 'standard',
        data_type: 'json',
        data_retention_days: 30,
    };
}

export function DefaultTimeseriesDataSourceConfig(): TimeseriesDataSourceConfig {
    return {
        kind: 'timeseries',
        columns: [],
        attachment_parameters: [],
    };
}
