module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    sass: {
      dist: {
        options: {
          style: 'expanded',
          sourcemap: 'auto'
        },
        files: {
          'frontend/css/livemixr.css': 'frontend/sass/livemixr.scss'
        },
      }
    },
    cssmin: {
      target: {
        files: [{
          expand: true,
          cwd: 'frontend/css',
          src: ['*.css', '!*.min.css'],
          dest: 'frontend/css',
          ext: '.min.css'
        }]
      }
    },
    watch: {
      css: {
        files: 'frontend/sass/**/*.scss',
        tasks: ['sass', 'cssmin']
      }
    }
  });

  // Load the plugins.
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // Tasks.
  grunt.registerTask('default', ['sass', 'cssmin', 'watch']);
  grunt.registerTask('build', ['sass', 'cssmin']);
  grunt.registerTask('watcher', ['watch']);

};