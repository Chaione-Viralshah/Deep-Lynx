<template>
  <div>
    <v-card>
      <v-toolbar flat color="white">
        <v-toolbar-title>{{$t('home.settingsDescription')}}</v-toolbar-title>
      </v-toolbar>

      <v-card-text>
        <error-banner :message="errorMessage"></error-banner>
        <success-banner :message="successMessage"></success-banner>
        <v-row>
          <v-col :cols="12">
            <p>{{$t('settings.explanation')}}</p>
            <v-form ref="form" v-model="valid" lazy-validation v-if="container">
              <v-text-field
                  v-model="container.name"
                  :label="$t('containers.name')"
                  required
                  disabled
                  class="disabled"
              ></v-text-field>
              <v-textarea
                  :rows="2"
                  v-model="container.description"
                  :label="$t('containers.description')"
                  :rules="[v => !!v || $t('dataMapping.required')]"
              ></v-textarea>

              <v-checkbox v-model="container.config.ontology_versioning_enabled">
                <template v-slot:label>
                  {{$t('containers.ontologyVersioningEnabled')}} <p class="text-caption" style="margin-left: 5px"> {{$t('beta')}}</p>
                </template>

                <template slot="prepend"><info-tooltip :message="$t('containers.ontologyVersioningHelp')"></info-tooltip> </template>
              </v-checkbox>
            </v-form>
            <h1 v-else>{{$t('containers.noneSelected')}}</h1>
          </v-col>
        </v-row>

      <v-row>
        <v-col :cols="12">
          <select-data-source-types :values="container.config.enabled_data_sources" @selected="setDataSources"></select-data-source-types>
        </v-col>
      </v-row>
      </v-card-text>

      <v-card-actions>
        <delete-container-dialog :containerID="container.id"></delete-container-dialog>
        <v-spacer></v-spacer>
        <v-btn color="blue darken-1" text @click="updateContainer" ><span v-if="!loading">{{$t("home.save")}}</span>
          <span v-if="loading"><v-progress-circular indeterminate></v-progress-circular></span>
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script lang="ts">
import {Component, Vue} from 'vue-property-decorator'
import {ContainerT} from "@/api/types";
import DeleteContainerDialog from "@/components/ontology/containers/deleteContainerDialog.vue";
import SelectDataSourceTypes from "@/components/dataSources/selectDataSourceTypes.vue";

@Component({components: {DeleteContainerDialog, SelectDataSourceTypes}})
export default class Settings extends Vue {
  container: ContainerT | undefined = undefined
  errorMessage = ""
  successMessage = ""
  loading = false
  valid = true

  beforeMount() {
    this.container = this.$store.getters.activeContainer
  }

  updateContainer() {
    // @ts-ignore
    if(!this.$refs.form!.validate()) return;

    this.$client.updateContainer(this.container)
        .then((container) => {
          this.$store.commit('setEditMode', false)
          this.$store.commit('setActiveContainer', container)
          this.successMessage = this.$t('containers.savedSuccessfully') as string

          setTimeout(() => this.successMessage = "", 5000)
        })
        .catch(e => {
          this.errorMessage = e
        })
        .finally(() => this.loading = false)
  }

  setDataSources(sources: string[]) {
    this.container!.config!.enabled_data_sources! = sources
  }
}
</script>
